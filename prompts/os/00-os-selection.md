# OS selection and family detection

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

> **Operator-laptop note**: when this prompt is reached via
> `prompts/00-bootstrap.md`, OS detection has already run over SSH from
> the laptop (`bootstrap_detect_remote_os`). This prompt is still a
> confirmation pass. Re-run `bootstrap_run_remote 'bash scripts/os-detect.sh'`
> if you need to double-check from the laptop.

## Purpose

Confirm the target host distribution before any other `prompts/os/` or
`prompts/tools/` spoke runs. This prompt detects the OS family with
`scripts/os-detect.sh` and pins the supported version matrix.

Downstream prompts must call `scripts/pkg.sh` or `scripts/os-detect.sh` when
they need OS facts. They must not rely on an OS environment variable from a
previous chat prompt.

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

### Step 2 — Confirm package helper detection

```bash
source scripts/pkg.sh
printf 'family=%s version=%s\n' "$(pkg_family)" "$(pkg_version)"
```

The package helper is the routing key for later prompts.

### Step 3 — Confirm the matrix entry

Cross-check the detected `<family> <version>` against the supported matrix above. If the version is outside the supported range:

- HALT.
- Do not attempt to proceed on an unsupported version.
- Either upgrade the host to a supported version or stop the install.

## CHECKPOINT 1

**STOP — operator question:** Does `bash scripts/os-detect.sh` print a supported `<family> <version>` (one of `ubuntu 24.04`, `ubuntu 25.x`, `debian 13`) — not `unsupported` and not an empty line?

Type `confirmed` to proceed.

## CHECKPOINT 2

**STOP — operator question:** Does `source scripts/pkg.sh; pkg_family` print `ubuntu` or `debian` (not empty, not `unsupported`)?

Type `confirmed` to proceed.

## Next

Branch on the `pkg_family` output:

- `ubuntu` → `prompts/os/10-ubuntu-prereqs.md`
- `debian` → `prompts/os/10-ubuntu-prereqs.md` (apt-based path; same prereqs)
