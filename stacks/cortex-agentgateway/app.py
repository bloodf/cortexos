#!/usr/bin/env python3
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


CONFIG_PATH = Path(os.environ.get("AGENTGATEWAY_CONFIG", "/app/config/tools.json"))
PORT = int(os.environ.get("AGENTGATEWAY_PORT", "18800"))


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    allowlist = data.get("allowlist")
    if not isinstance(allowlist, list) or not all(isinstance(item, str) for item in allowlist):
        raise RuntimeError("AgentGateway config must include string allowlist")
    return data


CONFIG = load_config()
ALLOWLIST = set(CONFIG["allowlist"])


def audit(event: dict[str, Any]) -> None:
    payload = {
        "event": "agentgateway.audit",
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **event,
    }
    print(json.dumps(payload, sort_keys=True), flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "CortexAgentGateway/2"

    def log_message(self, fmt: str, *args: Any) -> None:
        audit({"type": "http_access", "client": self.client_address[0], "message": fmt % args})

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, sort_keys=True).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, Any] | None:
        length = int(self.headers.get("content-length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None

    def do_GET(self) -> None:
        if self.path == "/health":
            self.send_json(200, {
                "ok": True,
                "service": "cortex-agentgateway",
                "policy_version": CONFIG.get("policy_version"),
                "allowlist_count": len(ALLOWLIST),
            })
            return
        if self.path == "/tools":
            self.send_json(200, {
                "policy_version": CONFIG.get("policy_version"),
                "trust_model": CONFIG.get("trust_model"),
                "auth": CONFIG.get("auth"),
                "tools": CONFIG.get("tools", []),
            })
            return
        self.send_json(404, {"ok": False, "error": "not_found"})

    def do_POST(self) -> None:
        if self.path != "/mcp/invoke":
            self.send_json(404, {"ok": False, "error": "not_found"})
            return

        body = self.read_json()
        if body is None:
            self.send_json(400, {"ok": False, "error": "invalid_json"})
            return

        tool = body.get("tool")
        if not isinstance(tool, str) or not tool:
            self.send_json(400, {"ok": False, "error": "tool_required"})
            return

        allowed = tool in ALLOWLIST
        audit({
            "type": "mcp_invoke",
            "tool": tool,
            "allowed": allowed,
            "agent_id": body.get("agent_id"),
            "project": body.get("project"),
            "args_keys": sorted((body.get("arguments") or {}).keys())
            if isinstance(body.get("arguments"), dict)
            else [],
        })
        if not allowed:
            self.send_json(403, {"ok": False, "error": "tool_not_allowed", "tool": tool})
            return

        self.send_json(200, {
            "ok": True,
            "tool": tool,
            "proxied": False,
            "message": "allowlist accepted; backend connector not attached yet",
        })


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(json.dumps({
        "event": "agentgateway.start",
        "port": PORT,
        "policy_version": CONFIG.get("policy_version"),
    }), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
