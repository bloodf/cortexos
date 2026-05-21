# Legacy Memory Import Preparation

## Purpose

Preserve the offline agent backup archive for later profile-scoped import into
Honcho. This is import material only, not live runtime state.

## Backup location

```text
/opt/cortexos/backups/memory-import-pending/
```

## Preserve

```bash
sudo install -d -m 0700 /opt/cortexos/backups/memory-import-pending

if [ -f /mnt/hdd/bot-backup-20260518T130522Z.tar.gz ]; then
  sudo cp /mnt/hdd/bot-backup-20260518T130522Z.tar.gz \
    /opt/cortexos/backups/memory-import-pending/
fi

cd /opt/cortexos/backups/memory-import-pending
sha256sum *.tar.gz > SHA256SUMS
sudo tee README.md >/dev/null <<'EOF'
# Legacy memory import-pending material

These files are retained only to import memory into Honcho workspaces later.
They must not be used as live runtime state.
EOF
```

## Import into Honcho

Generate profile-scoped JSONL first:

```bash
node scripts/honcho-memory-import.mjs \
  --backup /opt/cortexos/backups/memory-import-pending/bot-backup-20260518T130522Z.tar.gz \
  --profile primary
node scripts/honcho-memory-import.mjs \
  --backup /opt/cortexos/backups/memory-import-pending/bot-backup-20260518T130522Z.tar.gz \
  --profile secondary
```

After reviewing the generated JSONL, apply it to Honcho:

```bash
set -a
source /opt/cortexos/.secrets/honcho.env
set +a

node scripts/honcho-memory-import.mjs --profile primary --apply
node scripts/honcho-memory-import.mjs --profile secondary --apply
```

## Next

→ `prompts/tools/55-langfuse.md`
