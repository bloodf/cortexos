# OS selection and family detection

## Purpose

Confirm the target host distribution before any other `prompts/os/` or `prompts/tools/` spoke runs. This prompt detects the OS family with `scripts/os-detect.sh`, exports `CORTEX_OS_FAMILY` for the rest of the prompt sequence, and pins the supported version matrix.

All downstream prompts branch on `CORTEX_OS_FAMILY`. Distro-sensitive operations (package install, repo registration, firewall, SELinux) are routed through `scripts/pkg.sh`.

## Supported matrix

| Family | Versions |
|---|---|
| `ubuntu` | 22.04, 24.04 |
| `fedora` | 40, 41, 42 |
| `rhel` | RHEL 9, RHEL 10, Rocky 9, Rocky 10, AlmaLinux 9, AlmaLinux 10 |

`scripts/os-detect.sh` normalizes Rocky, AlmaLinux, and CentOS Stream to the `rhel` family. Anything not on this list emits `unsupported` and HALTs the prompt sequence.

## Steps

### Step 1 — Run the detector

```bash
bash scripts/os-detect.sh
```

Expected output: a single line `<family> <version>`, for example:

```text
ubuntu 24.04
fedora 41
rhel 9.4
```

If the output begins with `unsupported`, HALT. Open an issue describing the host (`cat /etc/os-release`) before continuing.

### Step 2 — Export the family

```bash
read -r CORTEX_OS_FAMILY CORTEX_OS_VERSION < <(bash scripts/os-detect.sh)
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

1. `bash scripts/os-detect.sh` printed one of `ubuntu`, `fedora`, or `rhel` as the family.
2. The printed version is present in the supported matrix above.
3. `CORTEX_OS_FAMILY` and `CORTEX_OS_VERSION` are exported in the current shell.
4. `echo "$CORTEX_OS_FAMILY"` returns the same family as Step 1.

Type "confirmed" to proceed.

## Next

Branch on `CORTEX_OS_FAMILY`:

- `ubuntu` → `prompts/os/10-ubuntu-prereqs.md`
- `fedora` → `prompts/os/10-fedora-prereqs.md`
- `rhel` → `prompts/os/10-rhel-prereqs.md`
