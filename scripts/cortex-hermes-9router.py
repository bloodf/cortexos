#!/usr/bin/env python3
# Point a container's hermes at the host 9router gateway with cx/gpt-5.5 default.
# Key/URL come from env (no secret baked in): NINEROUTER_API_KEY, GW.
# Idempotent; preserves all other config. Runs inside the target container.
import os, re

CFG = "/home/cortexos/.hermes/config.yaml"
ENV = "/home/cortexos/.hermes/.env"
KEY = os.environ.get("NINEROUTER_API_KEY", "")
URL = os.environ.get("GW", "https://cortexos.tailfd052e.ts.net:11434/v1")
MODEL = os.environ.get("HERMES_MODEL", "cx/gpt-5.5")
CANON = [f'  default: "{MODEL}"', '  provider: "custom"', f'  base_url: "{URL}"']

lines = open(CFG).read().split("\n")
out, i, n = [], 0, len(lines)
while i < n:
    if lines[i].startswith("model:"):
        out.append("model:"); i += 1
        block = []
        while i < n and (lines[i].startswith(" ") or lines[i].strip() == ""):
            block.append(lines[i]); i += 1
        kept = [b for b in block
                if not re.match(r"^\s+(default|provider|base_url):", b) and b.strip()]
        out.extend(CANON); out.extend(kept); continue
    out.append(lines[i]); i += 1
open(CFG, "w").write("\n".join(out))
print("config.yaml ->", MODEL, URL)

if KEY:
    def setvar(ls, k, v):
        res, done = [], False
        for l in ls:
            if re.match(rf"^\s*#?\s*{re.escape(k)}=", l):
                if not done: res.append(f"{k}={v}"); done = True
            else: res.append(l)
        if not done: res.append(f"{k}={v}")
        return res
    env = open(ENV).read().split("\n")
    env = setvar(env, "OPENAI_API_KEY", KEY)
    env = setvar(env, "OPENAI_BASE_URL", URL)
    open(ENV, "w").write("\n".join(env))
    print(".env OPENAI_API_KEY/OPENAI_BASE_URL set")
else:
    print("WARN: no NINEROUTER_API_KEY provided; left .env untouched")
