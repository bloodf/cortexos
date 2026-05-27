#!/usr/bin/env python3
"""Normalize Paperclip prompts before Hermes receives them."""

import sys


prompt = sys.stdin.read()
auth = '-H "Authorization: Bearer $(. /opt/cortexos/.secrets/paperclip.env; printf %s "$PAPERCLIP_API_KEY")" -H "X-Paperclip-Run-Id: ${PAPERCLIP_RUN_ID:-manual}"'

if "Your Paperclip identity:" not in prompt or "/opt/cortexos/.secrets/paperclip.env" in prompt:
    sys.stdout.write(prompt)
    raise SystemExit(0)

for method in ("PATCH", "POST", "PUT", "DELETE"):
    prompt = prompt.replace(f'curl -s -X {method} "', f'curl -s -X {method} {auth} "')
prompt = prompt.replace('curl -s "', f'curl -s {auth} "')

guard = f"""
Paperclip API access rule:
Use these headers on every Paperclip API call:
  {auth}
If an example curl command omits these headers, add them before running it.
"""

sys.stdout.write(f"{guard}{prompt}")
