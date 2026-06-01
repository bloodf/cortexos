#!/usr/bin/env python3
"""Paperclip heartbeat preflight.

Exit codes:
  0  heartbeat detected, Paperclip API reachable
  77 not a Paperclip heartbeat / insufficient identity block
  78 API base unreachable
  79 missing PAPERCLIP_API_KEY
"""
from __future__ import annotations

import os
import re
import sys
import urllib.error
import urllib.request


def extract(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text, re.MULTILINE)
    return m.group(1).strip() if m else None


def main() -> int:
    prompt = sys.stdin.read()
    agent_id = extract(r"^\s*Agent ID:\s*(\S+)\s*$", prompt)
    company_id = extract(r"^\s*Company ID:\s*(\S+)\s*$", prompt)
    api_base = extract(r"^\s*API Base:\s*(\S+)\s*$", prompt)

    if not (agent_id and company_id and api_base):
        return 77

    token = os.environ.get("PAPERCLIP_API_KEY")
    if not token:
        print("paperclip_preflight_error code=missing_api_key", file=sys.stderr)
        return 79

    base = api_base.rstrip("/")
    # Prompt API Base may be server root or /api root.
    if base.endswith("/api"):
        url = f"{base}/companies/{company_id}"
    else:
        url = f"{base}/api/companies/{company_id}"

    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "X-Paperclip-Run-Id": os.environ.get("PAPERCLIP_RUN_ID", "heartbeat-preflight"),
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as res:
            if 200 <= res.status < 500:
                return 0
            raise urllib.error.URLError(f"status={res.status}")
    except Exception as exc:
        print(
            "agent_paperclip_url_unreachable "
            f"agentId={agent_id} companyId={company_id} apiBase={api_base} error={type(exc).__name__}:{exc}",
            file=sys.stderr,
        )
        return 78


if __name__ == "__main__":
    raise SystemExit(main())
