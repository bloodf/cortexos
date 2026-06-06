# OS Family Selection

Detect the host operating system family and version. This is a one-time step that sets `CORTEX_OS_FAMILY` for all subsequent install prompts.

## Supported

- Ubuntu 24.04 LTS (or newer)
- Debian 13 (or newer)

## Detect

```bash
source scripts/pkg.sh
echo "Detected: $(pkg_family) $(pkg_version)"
```

## CHECKPOINT 1

**STOP — operator question:** Does the output show `ubuntu` or `debian` with a supported version?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
