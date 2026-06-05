# fzf (junegunn/fzf)

## Purpose

Install the [junegunn/fzf](https://github.com/junegunn/fzf) fuzzy-finder on the host and on every Incus instance. fzf is a small Go binary (~3 MB) that provides `Ctrl+R` history, `Ctrl+T` file picking, and `Alt+C` directory jumping in bash + zsh. It is a developer-experience baseline for the operator shell and for the dashboard's terminal page (see `prompts/tools/30-hermes-webui.md` for the dashboard integration; the dashboard also exposes `fzf` as a "Quick command" — see `packages/dashboard/src/lib/server/terminal/pty-bridge.ts`).

## Prerequisites

- `10-os-hardening.md` completed.
- The host has a default interactive shell — bash and/or zsh — already configured per `docs/CONFIG.md`.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo` (apt install). Authenticate **now**:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used.

## Ask user

| Field | Default | Notes |
| --- | --- | --- |
| Install on every Incus instance too? | `yes` | The brief says host + every Incus instance. |
| Bash keybindings (`/etc/profile.d/fzf.sh`)? | `yes` | Bash + zsh both supported. |
| Zsh keybindings (oh-my-zsh plugin line)? | `yes` | Adds `fzf` to `plugins=(...)` in `~/.zshrc`. |

```bash
read -p "Install on every Incus instance? (yes/no) [yes]: " _inst
FZF_INSTALL_INCUS="${_inst:-yes}"
read -p "Enable bash keybindings? (yes/no) [yes]: " _bash
FZF_BASH_BINDINGS="${_bash:-yes}"
read -p "Enable zsh keybindings? (yes/no) [yes]: " _zsh
FZF_ZSH_BINDINGS="${_zsh:-yes}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — `command -v fzf` prints nothing (no prior fzf install) on host with `pkg_family` in `ubuntu`/`debian`
- [ ] `pkg_install fzf` (apt) — the apt package is the current upstream release, not a stale backport, on Ubuntu 24.04 / Debian 13
- [ ] `/etc/profile.d/fzf.sh` is installed by the package — verify both key-bindings + completion scripts are present
- [ ] If `FZF_BASH_BINDINGS=yes`, confirm `/etc/bash.bashrc` sources the key-bindings script (Ubuntu/Debian do this by default)
- [ ] If `FZF_ZSH_BINDINGS=yes`, ensure `fzf` is in the `plugins=(...)` line of `~/.zshrc`
- [ ] If `FZF_INSTALL_INCUS=yes`, loop every Incus instance and `pkg_install fzf` inside
- [ ] CHECKPOINT 2 confirmed — `fzf --version` prints a version on host **and** on every Incus instance

## CHECKPOINT 1

**STOP — operator question:** Does `command -v fzf` print nothing on this host and is `pkg_family` one of `ubuntu` / `debian`?

```bash
test -z "$(command -v fzf)" && echo "no prior fzf install"
```

Type `confirmed` to proceed.

## Install (host)

```bash
pkg_install fzf
```

Verify the install (the package ships the binary, the man page, **and** the key-binding + completion shell scripts under `/usr/share/doc/fzf/examples/`):

```bash
fzf --version
test -r /usr/share/doc/fzf/examples/key-bindings.bash
test -r /usr/share/doc/fzf/examples/completion.bash
```

The package's postinst installs `/etc/profile.d/fzf.sh` which sources the key-bindings + completion scripts in interactive bash. Confirm:

```bash
test -r /etc/profile.d/fzf.sh
```

If `FZF_BASH_BINDINGS=yes` and the file is missing, fall back to the manual drop-in:

```bash
sudo tee /etc/profile.d/fzf.sh >/dev/null <<'EOF'
# shellcheck shell=bash
# fzf shell integration — bash key-bindings + completion
if [ -r /usr/share/doc/fzf/examples/key-bindings.bash ]; then
  source /usr/share/doc/fzf/examples/key-bindings.bash
fi
if [ -r /usr/share/doc/fzf/examples/completion.bash ]; then
  source /usr/share/doc/fzf/examples/completion.bash
fi
EOF
sudo chmod 0644 /etc/profile.d/fzf.sh
```

If `FZF_ZSH_BINDINGS=yes`, the apt package does **not** auto-wire zsh. Two options:

1. **oh-my-zsh plugin** (recommended for the host) — add `fzf` to the `plugins=(...)` line in `~/.zshrc` and ensure the plugin is symlinked. oh-my-zsh ships a `fzf` plugin in its default install; the apt package puts the key-binding script at `/usr/share/doc/fzf/examples/key-bindings.zsh`, which the oh-my-zsh plugin sources.

2. **Manual** — append to `~/.zshrc`:

   ```zsh
   if [ -r /usr/share/doc/fzf/examples/key-bindings.zsh ]; then
     source /usr/share/doc/fzf/examples/key-bindings.zsh
   fi
   if [ -r /usr/share/doc/fzf/examples/completion.zsh ]; then
     source /usr/share/doc/fzf/examples/completion.zsh
   fi
   ```

   The manual path is what the new Incus instances use (no oh-my-zsh on the base image by default).

## Install (every Incus instance)

If `FZF_INSTALL_INCUS=yes`, run the same install inside each instance. The per-profile step in `prompts/tools/60-incus-project.md` (step 2: Configure Instance) does this automatically for new instances; for existing instances, loop them now:

```bash
for inst in $(sudo incus list -c n --format csv | grep -v '^$' | cut -d, -f1); do
  echo "==> $inst"
  sudo incus exec "$inst" -- bash -c "command -v fzf >/dev/null || apt-get install -y -qq fzf"
done
```

The `||` short-circuit avoids re-installing on instances that already have fzf. The smoke test in `scripts/smoke/real-host.sh` does not currently assert on fzf; add a per-host assertion there as a follow-up.

## Verify

```bash
fzf --version
# Confirm an interactive fzf session works (sends SIGTERM after 2s)
echo "" | timeout 2 fzf || true
```

Expected: `fzf --version` prints something like `0.55.0 (debian)`; the `timeout 2 fzf` line exits 124 (killed by SIGTERM) without an error, confirming the binary loaded.

If `FZF_INSTALL_INCUS=yes`:

```bash
for inst in $(sudo incus list -c n --format csv | grep -v '^$' | cut -d, -f1); do
  echo "==> $inst: $(sudo incus exec "$inst" -- fzf --version 2>&1)"
done
```

## CHECKPOINT 2

**STOP — operator question:** Did `fzf --version` print a version on this host **and** on every Incus instance (`FZF_INSTALL_INCUS=yes` only)?

Type `confirmed` to proceed.

## Keybindings reference

| Shell | Trigger | Action |
| --- | --- | --- |
| bash | `Ctrl+R` | Fuzzy search command history |
| bash | `Ctrl+T` | Fuzzy pick a file, paste its path on the command line |
| bash | `Alt+C` | Fuzzy `cd` into a directory |
| zsh | `Ctrl+R` / `Ctrl+T` / `Alt+C` | Same as bash |
| All | `**` then `Tab` | File-path completion (e.g. `ssh **<Tab>`) |

For the dashboard's terminal page, the existing `term.fzf` op in `packages/dashboard/src/lib/server/terminal/pty-bridge.ts` dispatches `fzf` (with an optional `<query>` placeholder) into the operator's PTY. The Quick-commands palette on the Terminal page exposes it without needing a keyboard binding.

## Next

→ `prompts/tools/30c-boxbox.md` (host-only file manager)

→ If you skipped the per-profile install and want it on a single new instance, run `prompts/tools/60-incus-project.md` (the fzf install is in step 2).

→ Update `docs/CONFIG.md` to add a `## CLI Tool: fzf` section mirroring the other shell sections — see the patch in `git show` of this commit's follow-up.
