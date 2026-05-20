# OpenClaw Compaction Context (latest)

## Purpose

Install the `robertcuadra/compaction-context` plugin to preserve recent context
across compaction cycles.

## Prerequisites

- `40-openclaw.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** OpenClaw is running?

Type `confirmed` to proceed.

## Install

The upstream plugin ships `index.ts`. Build a JS artifact before installing,
and patch hook registration names for the current OpenClaw runtime.

```bash
rm -rf /tmp/compaction-context
git clone https://github.com/robertcuadra/compaction-context /tmp/compaction-context
cd /tmp/compaction-context
npm install
cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["index.ts"]
}
EOF
npm install --save-dev esbuild
npx esbuild index.ts --platform=node --format=esm --target=node20 --outfile=dist/index.js
python3 - <<'PY'
from pathlib import Path
p=Path('dist/index.js')
text=p.read_text()
text=text.replace('});\n  api.registerHook("before_agent_start", (_event, ctx) => {', '}, { name: "compaction-context-before-compaction" });\n  api.registerHook("before_agent_start", (_event, ctx) => {', 1)
text=text.replace('  });\n}\nexport {', '  }, { name: "compaction-context-before-agent-start" });\n}\nexport {', 1)
p.write_text(text)
PY
openclaw plugins install /tmp/compaction-context --force
```

## Verify

```bash
sudo systemctl restart openclaw-gateway
openclaw plugins list --enabled --verbose | grep -E 'compaction-context|Compaction Context'
openclaw plugins inspect compaction-context --runtime --json
```

Expected: plugin active and runtime hook registration present.

## CHECKPOINT 2

**STOP — operator question:** Compaction-context is active?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/45a-cortex-graph.md`
