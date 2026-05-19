# 00 — Bootstrap (operator laptop → remote VPS)

> **Read this first.** This is the single entry-point prompt for installing CortexOS.

## Todo

- [ ] Install RTK via `curl ... install.sh | sh` and confirm `rtk --version`
- [ ] Activate caveman mode in the AI agent
- [ ] Run `bootstrap_check_local_deps` (ssh/scp/git/sops/age + 4 CORTEX env vars)
- [ ] CHECKPOINT 0 confirmed — SSH key-auth + sops/age versions + env vars verified
- [ ] Run `bootstrap_ensure_operator_age_key` and add public key to `.sops.yaml`
- [ ] `sops updatekeys` every `templates/.secrets/*.enc.yaml`
- [ ] CHECKPOINT 1 confirmed — laptop age key decrypts `dashboard.enc.yaml`
- [ ] Run `bootstrap_detect_remote_os` and export `CORTEX_OS_FAMILY` / `CORTEX_OS_VERSION`
- [ ] CHECKPOINT 2 confirmed — detected family/version inside supported matrix
- [ ] Run `bootstrap_push_repo` to materialize repo at `/opt/cortexos` via `git archive | ssh tar -x`
- [ ] CHECKPOINT 3 confirmed — `/opt/cortexos/scripts/pkg.sh` present on VPS
- [ ] Run `bootstrap_run_remote 'bash scripts/preflight-tools.sh'` (exit 0)
- [ ] CHECKPOINT 3b confirmed — preflight-tools.sh exited 0 on VPS
- [ ] Run `bootstrap_push_secrets` to scp decrypted `.env` files to `/opt/cortexos/.secrets/`
- [ ] CHECKPOINT 5 confirmed — every `.env` file is mode `600` owned by `$CORTEX_USER`
- [ ] Dispatch tool spokes in order from `prompts/tools/_order.md`

## Mental model — read carefully

**You (the operator) and this AI agent are running on your laptop.** The VPS
is a remote machine you control over SSH. Every install step in CortexOS is
dispatched from this laptop to the VPS via `ssh` and `scp`. Nothing in this
prompt assumes the repo or any CortexOS code is already on the VPS — the
bootstrap will push the repo there itself.

This replaces the old "SSH into the VPS, clone the repo, run prompts inline"
flow. Operator-laptop is now the source of truth:

- The Git working copy lives on your laptop.
- Your laptop holds the operator age **private** key. The VPS never sees it.
- Decryption of SOPS-encrypted secrets happens on your laptop. Plaintext
  `.env` files are scp'd to the VPS at `/opt/cortexos/.secrets/`.
- All `prompts/os/*` and `prompts/tools/*` steps are dispatched as
  `ssh "$CORTEX_HOST" 'cd "$CORTEX_ROOT" && bash -c "<step>"'` commands from
  the laptop. Checkpoints still pause the agent until the operator confirms.

---

## Prerequisites on your laptop

- Linux with `bash`, `ssh`, `scp`, `git`.
- `sops` and `age` installed locally via distro package manager.
- SSH access to the target VPS as a sudo-capable user — public-key auth
  preferred. Confirm with `ssh "$CORTEX_USER@$CORTEX_HOST" true`.
- A clone of this repository on your laptop. You are reading this prompt
  from that clone.

### Operator AI-agent tooling

The agent driving this bootstrap (Claude Code, Codex, Cursor, …) runs on the
**laptop**, not the VPS. Two tools shrink agent token usage and noise:

**1. RTK (Rust Token Killer).** Transparent CLI proxy that filters `git`,
`gh`, `docker`, `ls`, etc. output to drop boilerplate. 60–90% savings on
common dev commands.

```bash
curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
rtk --version
rtk gain   # verify installation; should NOT say "command not found"
```

Once installed, the Claude Code hook auto-rewrites tool invocations
(`git status` → `rtk git status`) — zero agent overhead. If `rtk gain`
errors out you may have the reachingforthejack/rtk Rust Type Kit binary
shadowing the real one; remove it from `$PATH` first.

**2. Caveman mode.** Terse output protocol. The agent drops articles,
pleasantries, and hedging while keeping technical substance exact. Activate
it for the rest of the install by telling the agent:

```text
caveman mode
```

Code, commits, security warnings, and PR bodies stay in normal English —
the protocol only compresses chat-style explanations. Turn it off later
with `stop caveman` / `normal mode` if you prefer prose.

## Required environment variables

Export these in your laptop shell (or put them in `.env.local` at repo root
and `set -a; . ./.env.local; set +a`):

```bash
export CORTEX_HOST=<vps-hostname-or-ip>
export CORTEX_USER=<sudo-user>
export CORTEX_ROOT=/opt/cortexos
export CORTEX_DOMAIN=<dashboard-domain>
```

`CORTEX_ROOT` MUST be `/opt/cortexos`. Other paths are no longer supported.

---

## Step 0 — Source the bootstrap helpers

All ssh/scp dispatch is centralized in `scripts/bootstrap.sh`. Source it
once per shell session:

```bash
# from the repo root on your laptop
source scripts/bootstrap.sh
bootstrap_check_local_deps
```

`bootstrap_check_local_deps` verifies `ssh`, `scp`, `git`, `sops`, `age`,
and that `CORTEX_HOST`/`CORTEX_USER`/`CORTEX_ROOT`/`CORTEX_DOMAIN` are set.
It exits non-zero on any miss.

### Sudo acquisition

`scripts/bootstrap.sh` calls `ensure_sudo` at the top of every dispatch
subcommand. It prompts ONCE for the operator's sudo password, validates
the cache via `sudo -v`, then spawns a background keepalive that runs
`sudo -n true` every 60 seconds until the bootstrap process exits.

The password is NEVER written to a file, env var, or remote host. Only
sudo's own credential cache is used; the keepalive merely refreshes the
timestamp. The trap on `EXIT INT TERM` reaps the keepalive PID.

### CHECKPOINT 0

**STOP — operator question:** Did `bootstrap_check_local_deps` exit 0 — meaning `ssh "$CORTEX_USER@$CORTEX_HOST" true` connects without prompting, `sops --version` + `age --version` both print, and the four `CORTEX_*` env vars are all non-empty (not "unbound variable")?

Type `confirmed` to proceed.

---

## Step 1 — Operator age key (once per laptop)

The operator age **private** key lives only on this laptop. It is the
authority for editing and decrypting every secret in
`templates/.secrets/*.enc.yaml`.

```bash
bootstrap_ensure_operator_age_key
```

This idempotently:

- Creates `~/.config/sops/age/keys.txt` (mode `600`) if missing via
  `age-keygen`.
- Extracts the public recipient via `age-keygen -y`.
- Prints the public key.

Add the public key to `.sops.yaml` under `creation_rules.age` for the
`templates/.secrets/.*\.enc\.yaml$` rule if it is not already present.
Commit `.sops.yaml`. Then re-encrypt every secrets file for the new
recipient set:

```bash
for f in templates/.secrets/*.enc.yaml; do sops updatekeys "$f"; done
git add .sops.yaml templates/.secrets/*.enc.yaml
git commit -m "chore(secrets): add operator age recipient"
```

See `prompts/tools/12a-sops-bootstrap.md` for full SOPS lifecycle including
loss-of-key recovery.

### CHECKPOINT 1

**STOP — operator question:** Does `sops --decrypt templates/.secrets/dashboard.enc.yaml > /dev/null` exit 0 on the laptop (not `FAILED to decrypt` and not `no matching creation rules`) — proving the age pubkey from `age-keygen -y ~/.config/sops/age/keys.txt` is listed in `.sops.yaml`?

Type `confirmed` to proceed.

---

## Step 2 — Detect remote OS family over SSH

```bash
bootstrap_detect_remote_os
# exports CORTEX_OS_FAMILY and CORTEX_OS_VERSION in the current shell
printf 'family=%s version=%s\n' "$CORTEX_OS_FAMILY" "$CORTEX_OS_VERSION"
```

Internally this pipes `scripts/os-detect.sh` to the VPS:

```bash
ssh "$CORTEX_USER@$CORTEX_HOST" 'bash -s' < scripts/os-detect.sh
```

If the family is not `ubuntu` or `debian`, HALT. See
`prompts/os/00-os-selection.md` for the supported matrix.

### CHECKPOINT 2

**STOP — operator question:** Did `printf 'family=%s version=%s\n' "$CORTEX_OS_FAMILY" "$CORTEX_OS_VERSION"` print a family of `ubuntu` or `debian` with a supported version (24.04 / 25.x / 13) — not `unsupported` and not empty?

Type `confirmed` to proceed.

---

## Step 3 — Push the repository to the VPS

```bash
bootstrap_push_repo
```

This:

1. SSHes to the VPS and ensures `$CORTEX_ROOT` exists, owned by
   `$CORTEX_USER`.
2. Clones (or fast-forwards) the repository into `$CORTEX_ROOT` from the
   current laptop tree using `git archive | ssh tar -x`. No rsync, no
   external Git remote required on the VPS, no `.git` history pushed.
3. Verifies `$CORTEX_ROOT/scripts/pkg.sh` is present on the VPS.

### CHECKPOINT 3

**STOP — operator question:** Does `ssh "$CORTEX_USER@$CORTEX_HOST" 'test -f /opt/cortexos/scripts/pkg.sh && echo ok'` print `ok` (not `No such file or directory`) — proving the repo materialized at `/opt/cortexos`?

Type `confirmed` to proceed.

---

## Step 3b — VPS tool preflight (REQUIRED)

Before any `prompts/os/*` or `prompts/tools/*` spoke runs, the VPS must
have every required binary at or above its minimum version. Run the
remote preflight script via the dispatcher:

```bash
bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash scripts/preflight-tools.sh'
```

`scripts/preflight-tools.sh` checks: `node>=22`, `pnpm>=9`, `docker`,
`git`, `sops`, `age`, `jq`, `curl`, `openssl`, `gh`, `tailscale`, `ssh`,
`tar`. On any miss it prints a numbered remediation list and exits 2.

If it exits 2, the operator installs the missing tools on the VPS (or
re-runs the script with `--install-missing` to attempt automated apt /
curl-installer execution) and re-runs `bootstrap_run_remote` until exit 0.

### CHECKPOINT 3b

**STOP — operator question:** Did `bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash scripts/preflight-tools.sh'` exit 0 (not exit 2 with a remediation list)?

Type `confirmed` to proceed.

---

## Step 4 — Dispatch OS prereqs and tool prompts over SSH

Every prompt in `prompts/os/*` and `prompts/tools/*` is now executed by
wrapping its shell blocks with:

```bash
bootstrap_run_remote 'cd "$CORTEX_ROOT" && <command-from-the-prompt>'
```

`bootstrap_run_remote` exports `CORTEX_OS_FAMILY`, `CORTEX_OS_VERSION`,
`CORTEX_ROOT`, `CORTEX_DOMAIN`, and `CORTEX_USER` to the remote shell so
the prompt's existing `pkg.sh` dispatch logic works unchanged.

Run the order documented in `prompts/tools/_order.md`. The agent must
honor every `CHECKPOINT` in those prompts: when a prompt asks the operator
to confirm, the agent pauses and waits for "confirmed" before continuing.

Authoritative sequence (laptop drives each line via `bootstrap_run_remote`):

1. `prompts/os/00-os-selection.md` — confirmation only; family already
   exported in Step 2.
2. `prompts/os/10-ubuntu-prereqs.md` — apt prereqs.
3. `prompts/tools/00-preflight.md`
4. `prompts/tools/10-os-hardening.md`
5. `prompts/tools/11-docker.md`
6. `prompts/tools/12-tailscale.md`
7. **Step 5 — secrets** (see below) before `prompts/tools/13-caddy.md`.
8. `prompts/tools/13-caddy.md` through `prompts/tools/99-final-validation.md`
   in the order listed in `prompts/tools/_order.md`.

---

## Step 5 — Decrypt secrets locally; push plaintext to the VPS

The operator's age **private** key never leaves the laptop. Plaintext
`.env` files are produced on the laptop and scp'd to the VPS.

```bash
bootstrap_push_secrets
```

This:

1. Runs `SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt bash scripts/secrets-decrypt.sh`
   into a temp dir on the laptop.
2. `ssh`-creates `/opt/cortexos/.secrets/` with mode `0700`, owned by
   `$CORTEX_USER`.
3. `scp`s every produced `*.env` to `/opt/cortexos/.secrets/`.
4. SSH-applies `chmod 600` and `chown $CORTEX_USER:$CORTEX_USER` to each.
5. Wipes the laptop temp dir.

### CHECKPOINT 5

**STOP — operator question:** Does every line of `ssh "$CORTEX_USER@$CORTEX_HOST" 'stat -c "%a %U %n" /opt/cortexos/.secrets/*.env'` read `600 <CORTEX_USER> /opt/cortexos/.secrets/<name>.env` (no `644`, no `root` owner)?

Type `confirmed` to proceed.

---

## Step 6 — Continue with service prompts

Resume Step 4 dispatch from `prompts/tools/13-caddy.md`. Stop at every
checkpoint. When `prompts/tools/99-final-validation.md` passes, CortexOS
is installed.

If the dashboard is in scope, run `packages/cortex-dashboard/scripts/provision-vps.sh`
through `bootstrap_run_remote`:

```bash
bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash packages/cortex-dashboard/scripts/provision-vps.sh'
```

`provision-vps.sh` is idempotent and self-contained on the VPS side; the
bootstrap wrapper merely SSH-dispatches it.

---

## Notes

- This prompt and `scripts/bootstrap.sh` never read or write secrets in
  Git. Plaintext `.env` files exist only in `/opt/cortexos/.secrets/` on
  the VPS and in `~/.config/sops/age/keys.txt` on the laptop.
- The bootstrap dispatcher does not use `rsync`; the repo is materialized
  on the VPS via `git archive | ssh tar -x`.
- Every distro-sensitive operation still routes through
  `scripts/pkg.sh`, which is now invoked on the VPS by SSH-dispatched
  commands rather than locally.
