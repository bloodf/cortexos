#!/usr/bin/env python3
"""Normalize Paperclip prompts before Hermes receives them.

Responsibilities:
1. Inject the Paperclip auth-header guard rule + rewrite example curl commands
   in the heartbeat prompt so the agent always sends Authorization headers.
2. Assert the injected `API Base: http://<host>:<port>/api` line matches the
   live Paperclip server bind (instances/default/config.json -> server.port)
   OR the documented compatibility proxy port. On mismatch, fail fast on
   stderr (non-zero exit) so the hermes-paperclip wrapper aborts the run
   instead of producing process_lost / Connection refused.
3. Reachability probe: GET `<API Base>/health` (short timeout). If the URL
   is on an accepted port but the service behind it is down, abort — this
   catches "proxy-mode agent but proxy down" and similar deploy gaps that
   the port-set check alone would miss.

GUN-186 follow-up #3 / GUN-190.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_PATH = Path(
    os.environ.get(
        "PAPERCLIP_CONFIG",
        "/opt/cortexos/paperclip/instances/default/config.json",
    )
)
PROXY_PORT = int(os.environ.get("PAPERCLIP_PROXY_PORT", "3033"))
PROBE_TIMEOUT = float(os.environ.get("PAPERCLIP_PROMPT_GUARD_PROBE_TIMEOUT", "1.5"))
PROBE_DISABLED = os.environ.get("PAPERCLIP_PROMPT_GUARD_PROBE", "").lower() in {
    "off",
    "0",
    "false",
    "no",
}

AUTH = (
    '-H "Authorization: Bearer *** /opt/cortexos/.secrets/paperclip.env; '
    'printf %s "$PAPERCLIP_API_KEY")" '
    '-H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID:-manual}"'
)

API_BASE_RE = re.compile(
    r"API Base:\s*(https?://[^\s/]+)(?:/api)?",
    re.IGNORECASE,
)


def _server_port() -> int | None:
    try:
        cfg = json.loads(CONFIG_PATH.read_text())
        port = int(cfg.get("server", {}).get("port"))
        return port
    except Exception:  # noqa: BLE001
        return None


def _probe(api_base: str) -> tuple[bool, str]:
    """GET `<api_base>/api/health` with a short timeout.

    `api_base` is the host root (e.g. http://127.0.0.1:3034) without the
    /api suffix — the regex above strips it. /api/health exists on both the
    direct server and the compatibility proxy.
    """
    url = api_base.rstrip("/") + "/api/health"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=PROBE_TIMEOUT) as resp:
            ok = resp.status < 500
            return ok, f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        return e.code < 500, f"HTTPError {e.code}"
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return False, f"{type(e).__name__}: {e}"


def _assert_api_base_matches(prompt: str) -> None:
    """If the heartbeat prompt contains an `API Base:` line, ensure the port
    is the live server.port (or the documented proxy) AND that the URL is
    reachable. Otherwise abort.

    Set PAPERCLIP_PROMPT_GUARD_DISABLE=1 to bypass entirely.
    Set PAPERCLIP_PROMPT_GUARD_PROBE=off to keep port check but skip probe."""
    if os.environ.get("PAPERCLIP_PROMPT_GUARD_DISABLE") == "1":
        return
    server_port = _server_port()
    if server_port is None:
        # Can't read config — don't block the agent; surface a warning.
        sys.stderr.write(
            f"[paperclip-prompt-guard] WARN: could not read {CONFIG_PATH}; "
            "skipping port assertion\n"
        )
        return
    accepted = {server_port, PROXY_PORT}
    m = API_BASE_RE.search(prompt)
    if not m:
        return  # No API Base line — nothing to assert.
    base = m.group(1)
    # Extract port (default 80 for http if absent)
    host_port = base.rsplit(":", 1)
    if len(host_port) == 2 and host_port[1].isdigit():
        port = int(host_port[1])
    else:
        port = 80
    if port not in accepted:
        sys.stderr.write(
            "[paperclip-prompt-guard] FATAL: heartbeat prompt injects "
            f"API Base port {port} but live server.port={server_port} "
            f"(accepted: {sorted(accepted)}). Aborting run before "
            "process_lost. Fix adapterConfig.paperclipApiUrl or set "
            "PAPERCLIP_PROMPT_GUARD_DISABLE=1 to override.\n"
        )
        sys.exit(2)

    # Reachability probe (GUN-190): catches "configured for proxy mode but
    # proxy is down" and the inverse. Port check above already passed.
    if PROBE_DISABLED:
        return
    ok, detail = _probe(base)
    if not ok:
        mode = "proxy" if port == PROXY_PORT and port != server_port else "direct"
        sys.stderr.write(
            "[paperclip-prompt-guard] FATAL: heartbeat prompt injects "
            f"API Base {base}/api ({mode} mode) but /api/health is "
            f"unreachable ({detail}). Aborting run before process_lost. "
            "Bring the target service up or set "
            "PAPERCLIP_PROMPT_GUARD_PROBE=off to bypass the probe.\n"
        )
        sys.exit(3)


prompt = sys.stdin.read()

if "Your Paperclip identity:" not in prompt or "/opt/cortexos/.secrets/paperclip.env" in prompt:
    # Either not a Paperclip heartbeat (passthrough) or already guarded.
    # Still run the port assertion so even already-guarded prompts fail fast
    # on drift.
    _assert_api_base_matches(prompt)
    sys.stdout.write(prompt)
    raise SystemExit(0)

_assert_api_base_matches(prompt)

for method in ("PATCH", "POST", "PUT", "DELETE"):
    prompt = prompt.replace(f'curl -s -X {method} "', f'curl -s -X {method} {AUTH} "')
prompt = prompt.replace('curl -s "', f'curl -s {AUTH} "')

guard = f"""
Paperclip API access rule:
Use these headers on every Paperclip API call:
  {AUTH}
If an example curl command omits these headers, add them before running it.
"""

sys.stdout.write(f"{guard}{prompt}")
