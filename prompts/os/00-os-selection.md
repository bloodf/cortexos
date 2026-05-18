# OS selection and family detection

## Purpose

Confirm the target host distribution before any other `prompts/os/` or `prompts/tools/` spoke runs. This prompt detects the OS family with `scripts/os-detect.sh`, exports `CORTEX_OS_FAMILY` for the rest of the prompt sequence, and pins the supported version matrix.

All downstream prompts branch on `CORTEX_OS_FAMILY`. Distro-sensitive operations (package install, repo registration, firewall) are routed through `scripts/pkg.sh`.

## Supported matrix

| Family | Versions |
|---|---|
| `ubuntu` | 24.04 LTS, 25.x (latest) |
| `debian` | 13 (Trixie) |

`scripts/os-detect.sh` normalizes derivatives via `ID_LIKE` where possible. Anything not on this list emits `unsupported` and HALTs the prompt sequence.

## Steps

### Step 1 — Run the detector

```bash
bash scripts/os-detect.sh
```

Expected output: a single line `<family> <version> <subfamily>`, for example:

```text
ubuntu 24.04 ubuntu
ubuntu 25.04 ubuntu
debian 13 debian
```

If the output begins with `unsupported`, HALT. Open an issue describing the host (`cat /etc/os-release`) before continuing.

### Step 2 — Export the family

```bash
read -r CORTEX_OS_FAMILY CORTEX_OS_VERSION _ < <(bash scripts/os-detect.sh)
export CORTEX_OS_FAMILY CORTEX_OS_VERSION
printf 'family=%s version=%s\n' "$CORTEX_OS_FAMILY" "$CORTEX_OS_VERSION"
```

`CORTEX_OS_FAMILY` is the routing key for every later prompt. Keep it set for the remainder of the operator session; re-export it in any new shell.

### Step 3 — Confirm the matrix entry

Cross-check the detected `<family> <version>` against the supported matrix above. If the version is outside the supported range:

- HALT.
- Do not attempt to proceed on an unsupported version.
- Either upgrade the host to a supported version or stop the install.

## CHECKPOINT 1

Operator: confirm the following before the agent proceeds.

1. `bash scripts/os-detect.sh` printed `ubuntu` or `debian` as the family.
2. The printed version is present in the supported matrix above.
3. `CORTEX_OS_FAMILY` and `CORTEX_OS_VERSION` are exported in the current shell.
4. `echo "$CORTEX_OS_FAMILY"` returns the same family as Step 1.

Type "confirmed" to proceed.

## Next

Branch on `CORTEX_OS_FAMILY`:

- `ubuntu` → `prompts/os/10-ubuntu-prereqs.md`
- `debian` → `prompts/os/10-ubuntu-prereqs.md` (apt-based path; same prereqs)
