# herdr (herdr.dev)

## Purpose

Install [herdr](https://herdr.dev) on the host — a terminal workspace manager for AI coding agents. herdr runs a persistent session server (like tmux, but agent-aware) with workspaces, tabs, panes, git-worktree management, and an agent supervisor (`herdr agent`), all driven from one binary. It complements `09-tmux.md` (tmux stays the canonical session layer for operator SSH sessions; herdr is the workspace layer for agent-driven coding work) and pairs with `30b-fzf.md` / `30c-boxbox.md` as operator-shell tooling.

## Prerequisites

- `10-os-hardening.md` completed.
- `curl` and `awk` available (both are in the `00-preflight.md` baseline).
- `~/.local/bin` on the operator `$PATH` (default in the CortexOS zsh config — see `docs/CONFIG.md`).

## Distro selection

herdr ships a static binary per `os-arch` target (linux x86_64/aarch64, macOS), so there is no distro package to select:

```bash
uname -s; uname -m   # must be Linux + x86_64 or aarch64
```

## Sudo gate

**Not required.** herdr installs to `$HOME/.local/bin` as the operator user — no root, no system paths.

## Ask user

| Field | Default | Notes |
| --- | --- | --- |
| Install on every Incus instance too? | `no` | Host-first tool; agent containers usually run tmux + hermes only. |
| Update channel | `stable` | `herdr channel set <stable\|preview>` after install. |

```bash
read -p "Install on every Incus instance? (yes/no) [no]: " _inst
HERDR_INSTALL_INCUS="${_inst:-no}"
read -p "Update channel (stable/preview) [stable]: " _chan
HERDR_CHANNEL="${_chan:-stable}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — `command -v herdr` prints nothing (no prior install) and platform is `linux/x86_64` or `linux/aarch64`
- [ ] Inspect the installer before running it (`curl -fsSL https://herdr.dev/install.sh -o /tmp/herdr-install.sh` + read) — CortexOS policy: never pipe an unread script into `sh`
- [ ] Run the installer — binary lands at `~/.local/bin/herdr`
- [ ] `herdr --version` prints a version
- [ ] If `HERDR_CHANNEL=preview`, run `herdr channel set preview`
- [ ] If `HERDR_INSTALL_INCUS=yes`, loop every Incus instance and install as the instance operator user
- [ ] CHECKPOINT 2 confirmed — `herdr status` reports a healthy client (server starts on first `herdr` launch)

## CHECKPOINT 1

**STOP — operator question:** Does `command -v herdr` print nothing on this host, and is the platform supported?

```bash
test -z "$(command -v herdr)" && echo "no prior herdr install"
uname -sm
```

Type `confirmed` to proceed.

## Install (host)

Download and inspect the installer first, then run it:

```bash
curl -fsSL https://herdr.dev/install.sh -o /tmp/herdr-install.sh
less /tmp/herdr-install.sh   # plain POSIX sh: manifest fetch → binary download → ~/.local/bin
sh /tmp/herdr-install.sh
```

The installer fetches `https://herdr.dev/latest.json`, downloads the binary for the detected `os-arch` target, and installs to `${HERDR_INSTALL_DIR:-$HOME/.local/bin}/herdr`. No root, no system files.

Verify:

```bash
herdr --version
```

If the shell can't find it, `~/.local/bin` is missing from `$PATH` — add `export PATH="$HOME/.local/bin:$PATH"` to `~/.zshrc` per `docs/CONFIG.md`.

Self-updates are built in (no apt hook needed):

```bash
herdr update              # manual update to latest on the chosen channel
herdr channel set stable  # or preview
```

## Install (every Incus instance)

If `HERDR_INSTALL_INCUS=yes`, run the same user-level install inside each instance as the operator user (NOT root — the binary belongs in the operator's `~/.local/bin`):

```bash
for inst in $(sudo incus list -c n --format csv | grep -v '^$' | cut -d, -f1); do
  echo "==> $inst"
  sudo incus exec "$inst" -- su - cortexos -c \
    'command -v herdr >/dev/null || { curl -fsSL https://herdr.dev/install.sh -o /tmp/herdr-install.sh && sh /tmp/herdr-install.sh; }'
done
```

## Verify

```bash
herdr --version          # prints e.g. "herdr 0.6.8"
herdr status 2>&1 | head -5
```

Expected: a version string; `herdr status` reports the client and (if launched) server state. The persistent session server starts on the first plain `herdr` launch — it is per-user and needs no systemd unit.

## CHECKPOINT 2

**STOP — operator question:** Did `herdr --version` print a version on this host (and on every Incus instance if `HERDR_INSTALL_INCUS=yes`)?

Type `confirmed` to proceed.

## Command reference

| Command | Action |
| --- | --- |
| `herdr` | Launch or attach to the persistent session |
| `herdr --session <name>` | Named session |
| `herdr --remote <ssh-target>` | Attach to a remote herdr over SSH |
| `herdr workspace / tab / pane <…>` | Workspace, tab, and pane management |
| `herdr worktree <…>` | Git worktree management |
| `herdr agent <…>` | Agent supervisor subcommands |
| `herdr update` | Self-update on the chosen channel |
| `herdr server stop` / `reload-config` | Server lifecycle via the API socket |

Config lives at `~/.config/herdr/config.toml` (`herdr config <subcommand>` to manage; `herdr config reset-keys` backs up and resets keybindings).

## Next

→ `prompts/tools/31-9router.md` (AI gateway)
