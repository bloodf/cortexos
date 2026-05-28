#!/usr/bin/env python3
"""Unix-socket root command helper for Cortex Dashboard.

The helper intentionally stores no secret values and no stdout/stderr bodies in
its structured log. The dashboard records the matching Postgres audit row.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import threading
import uuid
from typing import Any


DEFAULT_SOCKET = "/run/cortexos/dashboard-helper.sock"
MAX_REQUEST_BYTES = int(os.environ.get("HELPER_MAX_REQUEST_BYTES", str(1024 * 1024)))
MAX_TIMEOUT_MS = int(os.environ.get("HELPER_MAX_TIMEOUT_MS", "3600000"))
ENV_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def utc_now() -> str:
	return dt.datetime.now(dt.timezone.utc).isoformat()


def sha256(data: bytes) -> str:
	return hashlib.sha256(data).hexdigest()


def log_event(event: dict[str, Any]) -> None:
	event.setdefault("schema", "cortexos.dashboard.root_helper.command.v1")
	event.setdefault("logged_at", utc_now())
	print(json.dumps(event, sort_keys=True, separators=(",", ":")), flush=True)


def validate_request(raw: dict[str, Any]) -> dict[str, Any]:
	request_id = str(raw.get("request_id") or "")
	try:
		uuid.UUID(request_id)
	except ValueError as exc:
		raise ValueError("invalid request_id") from exc

	command = str(raw.get("command") or "").strip()
	if not command:
		raise ValueError("command is required")

	argv = raw.get("argv") or []
	if not isinstance(argv, list) or not all(isinstance(item, str) for item in argv):
		raise ValueError("argv must be a string array")

	cwd = str(raw.get("cwd") or "/")
	stdin = raw.get("stdin") or ""
	if not isinstance(stdin, str):
		raise ValueError("stdin must be a string")

	timeout_ms = int(raw.get("timeout_ms") or 30000)
	timeout_ms = max(1, min(timeout_ms, MAX_TIMEOUT_MS))

	env_input = raw.get("env") or {}
	if not isinstance(env_input, dict):
		raise ValueError("env must be an object")
	env: dict[str, str] = {}
	for key, value in env_input.items():
		name = str(key)
		if not ENV_NAME_RE.match(name):
			raise ValueError(f"invalid env name: {name}")
		env[name] = str(value)

	return {
		"request_id": request_id,
		"command": command,
		"argv": argv,
		"cwd": cwd,
		"stdin": stdin,
		"timeout_ms": timeout_ms,
		"env": env,
		"dry_run": bool(raw.get("dry_run")),
		"requested_by": str(raw.get("requested_by") or "trusted-dashboard"),
		"target_scope": str(raw.get("target_scope") or "host"),
		"mutation_class": str(raw.get("mutation_class") or "unknown"),
		"metadata": raw.get("metadata") if isinstance(raw.get("metadata"), dict) else {},
	}


def execute_command(req: dict[str, Any]) -> dict[str, Any]:
	started_at = utc_now()
	argv = [req["command"], *req["argv"]]
	log_event(
		{
			"event": "command_started",
			"request_id": req["request_id"],
			"requested_by": req["requested_by"],
			"command": req["command"],
			"argv": req["argv"],
			"cwd": req["cwd"],
			"env_allowlist": sorted(req["env"].keys()),
			"target_scope": req["target_scope"],
			"mutation_class": req["mutation_class"],
			"dry_run": req["dry_run"],
			"metadata": req["metadata"],
		}
	)

	stdout = b""
	stderr = b""
	exit_code: int | None = 0
	signal: str | None = None
	status = "succeeded"
	error: str | None = None

	if req["dry_run"]:
		status = "dry_run"
	else:
		env = os.environ.copy()
		env.update(req["env"])
		try:
			result = subprocess.run(
				argv,
				cwd=req["cwd"],
				input=req["stdin"].encode("utf-8"),
				stdout=subprocess.PIPE,
				stderr=subprocess.PIPE,
				timeout=req["timeout_ms"] / 1000,
				env=env,
				check=False,
			)
			stdout = result.stdout
			stderr = result.stderr
			exit_code = result.returncode
			status = "succeeded" if result.returncode == 0 else "failed"
		except subprocess.TimeoutExpired as exc:
			stdout = exc.stdout or b""
			stderr = exc.stderr or b""
			exit_code = None
			signal = "timeout"
			status = "timeout"
			error = "command timed out"
		except Exception as exc:  # noqa: BLE001 - boundary must report any helper failure.
			exit_code = None
			status = "error"
			error = str(exc)

	finished_at = utc_now()
	response = {
		"request_id": req["request_id"],
		"status": status,
		"started_at": started_at,
		"finished_at": finished_at,
		"stdout": stdout.decode("utf-8", errors="replace"),
		"stderr": stderr.decode("utf-8", errors="replace"),
		"stdout_sha256": sha256(stdout),
		"stderr_sha256": sha256(stderr),
		"stdout_bytes": len(stdout),
		"stderr_bytes": len(stderr),
		"exit_code": exit_code,
		"signal": signal,
		"error": error,
	}
	log_event(
		{
			"event": "command_finished",
			"request_id": req["request_id"],
			"status": status,
			"exit_code": exit_code,
			"signal": signal,
			"stdout_sha256": response["stdout_sha256"],
			"stderr_sha256": response["stderr_sha256"],
			"stdout_bytes": response["stdout_bytes"],
			"stderr_bytes": response["stderr_bytes"],
			"error": error,
		}
	)
	return response


def read_request(conn: socket.socket) -> dict[str, Any]:
	chunks: list[bytes] = []
	total = 0
	while True:
		chunk = conn.recv(65536)
		if not chunk:
			break
		chunks.append(chunk)
		total += len(chunk)
		if total > MAX_REQUEST_BYTES:
			raise ValueError("request too large")
		if b"\n" in chunk:
			break
	payload = b"".join(chunks).split(b"\n", 1)[0]
	return json.loads(payload.decode("utf-8"))


def handle_connection(conn: socket.socket) -> None:
	with conn:
		try:
			request = validate_request(read_request(conn))
			response = execute_command(request)
		except Exception as exc:  # noqa: BLE001 - protocol boundary.
			response = {
				"request_id": None,
				"status": "error",
				"started_at": None,
				"finished_at": utc_now(),
				"stdout": "",
				"stderr": "",
				"stdout_sha256": sha256(b""),
				"stderr_sha256": sha256(b""),
				"stdout_bytes": 0,
				"stderr_bytes": 0,
				"exit_code": None,
				"signal": None,
				"error": str(exc),
			}
			log_event({"event": "request_error", "error": str(exc)})
		conn.sendall(json.dumps(response, separators=(",", ":")).encode("utf-8") + b"\n")


def make_socket() -> socket.socket:
	if int(os.environ.get("LISTEN_FDS", "0")) >= 1:
		listener = socket.socket(fileno=3)
		listener.setblocking(True)
		return listener

	socket_path = os.environ.get("DASHBOARD_HELPER_SOCKET", DEFAULT_SOCKET)
	os.makedirs(os.path.dirname(socket_path), mode=0o750, exist_ok=True)
	try:
		os.unlink(socket_path)
	except FileNotFoundError:
		pass
	listener = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
	listener.bind(socket_path)
	os.chmod(socket_path, 0o660)
	listener.listen(32)
	return listener


def main() -> int:
	listener = make_socket()
	log_event({"event": "helper_started", "socket": os.environ.get("DASHBOARD_HELPER_SOCKET", DEFAULT_SOCKET)})
	while True:
		conn, _ = listener.accept()
		thread = threading.Thread(target=handle_connection, args=(conn,), daemon=True)
		thread.start()


if __name__ == "__main__":
	try:
		raise SystemExit(main())
	except KeyboardInterrupt:
		sys.exit(0)
