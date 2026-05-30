# tmux on CortexOS — a beginner's guide

This is the tmux setup that ships on the CortexOS host and inside every Incus
project instance. It is a **single source of truth**: the file
[`stacks/cortex-incus/tmux.conf`](../stacks/cortex-incus/tmux.conf) is the only
copy that matters. It is deployed to `~/.tmux.conf` on the host and instances,
baked into the Incus base image, and installed by
[`scripts/ops/cortex-tmux-setup.sh`](../scripts/ops/cortex-tmux-setup.sh).

If you have never used tmux, read the next two sections first. If you just want
the keys, jump to [Keybinding reference](#keybinding-reference).

---

## 1. The prefix model (read this first)

tmux listens for a **prefix** key, then a second key that picks the command.

- The prefix on CortexOS is **`Ctrl-a`** (written `C-a`).
- `prefix X` means: **press `Ctrl-a`, let go, then press `X`.** It is two
  steps, *not* a chord. You do **not** hold Ctrl for the second key unless the
  table says so (e.g. `prefix C-s` = `Ctrl-a` then `Ctrl-s`).
- Made a mistake mid-prefix? Press **`Esc`** or **`Ctrl-c`** to cancel.

### Notation used in this doc

| Notation | Means |
|----------|-------|
| `C-x`    | Hold **Ctrl** and press `x` |
| `M-x`    | Hold **Alt** (Meta) and press `x` |
| `prefix` | `C-a` (press and release) |
| `prefix x` | `C-a`, release, then `x` |
| `prefix C-x` | `C-a`, release, then `Ctrl-x` |

> **Tip:** to send a literal `Ctrl-a` to the program inside the pane (e.g.
> "go to start of line" in bash), press `prefix C-a` (that's `C-a C-a`).

---

## 2. Your first five minutes

```bash
tmux new -s work      # start a new session named "work"
# ... do stuff in the shell ...
# press: C-a  then  |          -> split the pane left/right
# press: C-a  then  -          -> split the pane top/bottom
# press: C-a  then  arrow keys -> move between panes
# press: C-a  then  c          -> open a new window
# press: C-a  then  d          -> detach (leaves everything running)

tmux attach -t work   # come back later, exactly where you left off
```

After a reboot you do **not** need to recreate anything — just run `tmux` and
your sessions are restored automatically (see [Persistence](#persistence)).

---

## 3. Keybinding reference

All keys are pressed **after** the prefix (`C-a`). Verified against the live
binding table produced by sourcing the canonical conf (see
[Conflicts](#conflicts--how-this-conf-avoids-them) for how that is guaranteed).

### Sessions

| Key | Action |
|-----|--------|
| `prefix d` | Detach (session keeps running in the background) |
| `prefix S` | **Save** all sessions now (resurrect) |
| `prefix R` | **Restore** the last saved snapshot (resurrect) |
| `prefix M` | Save a **named** snapshot (prompts for a name) |
| `prefix N` | Restore a **named** snapshot (prompts for a name) |
| `prefix $` | Rename the current session |
| `prefix (` / `prefix )` | Previous / next session |
| `prefix L` | Switch to the last-used session |

### Windows (tabs)

| Key | Action |
|-----|--------|
| `prefix c` | New window (in the current pane's directory) |
| `prefix ,` | Rename window |
| `prefix n` / `prefix p` | Next / previous window |
| `prefix 0`–`9` | Jump to window by number |
| `prefix w` | Choose a window from a zoomable tree |
| `prefix C-t` | Choose tree (zoomed) of sessions + windows |
| `prefix &` | Kill the current window (asks first) |

### Panes

| Key | Action |
|-----|--------|
| `prefix \|` | Split left/right, keep current directory |
| `prefix -` | Split top/bottom, keep current directory |
| `prefix ←↑↓→` | Move focus between panes |
| `prefix z` | Zoom / un-zoom the current pane |
| `prefix o` | Cycle to the next pane |
| `prefix q` | Show pane numbers (press the number to jump) |
| `prefix {` / `prefix }` | Swap pane up / down |
| `prefix x` | Kill the current pane (asks first) |
| `prefix [` | Enter copy mode (scroll back; vi keys) |
| `prefix ]` | Paste the most recent buffer |
| `prefix *` | Kill a hung/runaway process in the pane (tmux-cowboy) |

### Config / misc

| Key | Action |
|-----|--------|
| `prefix r` | Reload `~/.tmux.conf` (shows "tmux config reloaded") |
| `prefix C-a` | Send a literal `Ctrl-a` to the program in the pane |
| `prefix I` | Install plugins (TPM) |
| `prefix U` | Update plugins (TPM) |
| `prefix M-u` | Remove plugins no longer listed (TPM) |

### Plugin launchers

| Key | Plugin | Action |
|-----|--------|--------|
| `prefix C-s` | tmux-sidebar | Toggle the file-tree sidebar |
| `prefix C-b` | tmux-sidebar | Toggle the sidebar **and focus** it |
| `prefix Tab` | treemux | Toggle the nvim-based file tree |
| `prefix C-y` | treemux | Toggle the nvim tree **and focus** it |
| `prefix C-e` | extrakto | Fuzzy-grab text/paths/URLs from the pane |
| `prefix C-f` | tmux-fzf | fzf control menu (sessions/windows/panes/…) |
| `prefix F`   | tmux-fzf | Same menu (plugin's own default key) |
| `prefix C-Space` | tmux-menus | Pop-up command menus |
| `prefix T` | muxile | Remote/mobile control menu |

> **Mouse is on.** You can click panes/windows, drag borders to resize, and
> scroll with the wheel (tmux-mighty-scroll makes scrolling behave inside less,
> man, vim, etc.).

---

## 4. The 17 plugins

Managed by [TPM](https://github.com/tmux-plugins/tpm). "Passive" means it works
in the background with no key of its own.

| # | Plugin | Purpose | Key |
|---|--------|---------|-----|
| 1 | tmux-plugins/tpm | Plugin manager | `prefix I` / `U` / `M-u` |
| 2 | b0o/tmux-autoreload | Reloads the conf automatically when it changes | passive |
| 3 | tmux-plugins/tmux-cowboy | Kill a hung process in a pane | `prefix *` |
| 4 | thepante/tmux-git-autofetch | Periodically `git fetch`es repos open in panes | passive |
| 5 | jaclu/tmux-menus | Pop-up menus for common commands | `prefix C-Space` |
| 6 | tmux-plugins/tmux-sidebar | File-tree sidebar (`tree`) | `prefix C-s`, `prefix C-b` |
| 7 | tmux-plugins/tmux-sensible | Sane baseline tmux options | passive |
| 8 | noscript/tmux-mighty-scroll | Smart mouse scrolling in pagers/editors | passive |
| 9 | tmux-plugins/tmux-continuum | Auto-save + auto-restore sessions | passive (auto) |
| 10 | sainnhe/tmux-fzf | fzf-driven control menu | `prefix C-f`, `prefix F` |
| 11 | tmux-plugins/tmux-resurrect | Manual save/restore of sessions | `prefix S`, `prefix R` |
| 12 | spywhere/tmux-named-snapshot | Named, on-demand session snapshots | `prefix M`, `prefix N` |
| 13 | thewtex/tmux-mem-cpu-load | CPU/MEM/load indicator in the status bar | passive |
| 14 | tmux-plugins/tmux-prefix-highlight | Shows when prefix/copy/sync is active | passive |
| 15 | laktak/extrakto | Fuzzy-extract text/paths/URLs from output | `prefix C-e` |
| 16 | bjesus/muxile | Remote/mobile control surface | `prefix T` |
| 17 | kiyoon/treemux | nvim-powered file-tree sidebar | `prefix Tab`, `prefix C-y` |

Verify the count anywhere with:

```bash
ls ~/.tmux/plugins | wc -l   # expect 17
```

---

## 5. Persistence

Two plugins keep your work safe across detach, logout, and reboot:

- **tmux-continuum** (automatic):
  - Auto-**saves** every **15 minutes** (`@continuum-save-interval "15"` — the
    value is in *minutes*).
  - Auto-**restores** your sessions when the tmux server next starts
    (`@continuum-restore "on"`). So after a reboot, just run `tmux`.
- **tmux-resurrect** (manual, on demand):
  - Save now: **`prefix S`**  ·  Restore last: **`prefix R`**
  - Captures pane contents (`@resurrect-capture-pane-contents "on"`).
  - Snapshots live in **`~/.tmux/resurrect`** (`@resurrect-dir`).
- **tmux-named-snapshot** (manual, labelled): **`prefix M`** to save a snapshot
  under a name, **`prefix N`** to restore one. Use this before a destructive
  operation so you can roll back to a specific point. (The `cortex-rebuild`
  session uses named snapshots before each destructive rebuild phase.)

---

## 6. Daily workflow

```bash
# start work
tmux new -s myproject

# split / open windows as needed (see the key tables above)

# step away — everything keeps running
#   prefix d         (detach)

# come back
tmux attach -t myproject
tmux ls               # list sessions   (alias: tls)
tmux attach -t NAME   # attach          (alias: ta NAME)
tmux new -s NAME      # new session     (alias: tn NAME)

# after a reboot: just run `tmux` — continuum auto-restores your sessions.

# checkpoint before something risky:
#   prefix M   -> name it e.g. "pre-migration"
#   ... if it goes wrong ...
#   prefix N   -> restore "pre-migration"
```

---

## 7. Conflicts & how this conf avoids them

This is the part that keeps the keymap stable. **Read it before editing the
conf.**

### The problem: load order and "last bind wins"

TPM loads every plugin at the **bottom** of `tmux.conf` via
`run "~/.tmux/plugins/tpm/tpm"`. Many plugins **bind their own default keys when
they load**. Because plugins load *after* the rest of the file, a plugin's
default binding will silently **overwrite** any earlier manual `bind` line that
used the same key. The last bind to run wins, and TPM runs last.

Concretely, before this conf was hardened, several keys collided:

| Key | Wanted | Was clobbered by |
|-----|--------|------------------|
| `C-s` | open the sidebar | tmux-resurrect's default **save** key (`C-s`) |
| `Tab` | one tree only | tmux-sidebar **and** treemux **and** extrakto all default to `prefix Tab` |
| `C-m` | (should be free) | tmux-named-snapshot default save key — and **`C-m` == Enter** in a terminal |
| `C-n` | (should be free) | tmux-named-snapshot default restore key |
| `R` | resurrect restore | tmux-sensible also binds `R` (to source the conf) |

### The fix: set plugin key **options** before `run tpm`

Instead of fighting plugins with manual `bind` lines (which lose the race), the
conf **sets each plugin's key *option*** — and does so **above** the
`run "~/.tmux/plugins/tpm/tpm"` line. When the plugin loads, it reads its option
and binds the key *we* chose, deterministically. For example:

```tmux
set -g @resurrect-save 'S'        # not the default C-s
set -g @resurrect-restore 'R'
set -g @sidebar-tree 'C-s'        # sidebar owns C-s cleanly now
set -g @treemux-tree 'Tab'        # treemux keeps Tab; sidebar moved off it
set -g @extrakto_key 'C-e'        # extrakto off Tab
set -g @menus_trigger 'C-Space'
set -g @named-snapshot-save 'M:*'     # off C-m (=Enter!)
set -g @named-snapshot-restore 'N:*'  # off C-n
run "~/.tmux/plugins/tpm/tpm"     # <-- plugins load AFTER the options above
```

### Rules for future edits

1. **Never bind, or let a plugin default to, a terminal-equivalent control
   key:** `C-m` (=Enter), `C-i` (=Tab), `C-h` (=Backspace), `C-[` (=Esc).
   Binding these breaks Enter/Tab/Backspace/Esc inside your programs.
2. To change a plugin's key, **set its `@…` option above `run tpm`** — do not
   add a bare `bind` line for a key the plugin also wants.
3. Two plugins must never share a key. Sidebar (`C-s`/`C-b`) and treemux
   (`Tab`/`C-y`) are deliberately split.
4. After any change, run the self-check (below). It fails loudly on a clobber.

### The self-check (proves intent == live)

`scripts/ops/cortex-tmux-setup.sh` runs this automatically after installing
plugins (skip with `--no-selfcheck`). To run the audit by hand:

```bash
# Source the conf in an ISOLATED server started with -f /dev/null so it does
# NOT auto-source ~/.tmux.conf and pollute the test, then inspect the result.
tmux -L audit -f /dev/null new-session -d
tmux -L audit source-file /opt/cortexos/stacks/cortex-incus/tmux.conf
sleep 5                                  # let TPM background-load plugins
tmux -L audit list-keys -T prefix | sort # scan for surprises / duplicates
# spot-check the keys that used to collide:
tmux -L audit list-keys -T prefix C-s    # -> tmux-sidebar
tmux -L audit list-keys -T prefix S      # -> tmux-resurrect save
tmux -L audit list-keys -T prefix R      # -> tmux-resurrect restore
tmux -L audit list-keys -T prefix C-e    # -> extrakto
# these must print NOTHING (terminal-equivalent keys stay unbound):
tmux -L audit list-keys -T prefix C-m
tmux -L audit list-keys -T prefix C-h
tmux -L audit kill-server
```

The `-f /dev/null` is essential: a normal new tmux server auto-sources
`~/.tmux.conf` first, so without it you'd be testing the union of the old and
new configs, not the conf under test.

---

## See also

- [`stacks/cortex-incus/tmux.conf`](../stacks/cortex-incus/tmux.conf) — the conf itself.
- [`scripts/ops/cortex-tmux-setup.sh`](../scripts/ops/cortex-tmux-setup.sh) — installer + self-check.
- [Setup Guide](SETUP_GUIDE.md) — full host/instance provisioning.
- [Server Dev](SERVER-DEV.md) — the dashboard build/restart loop.
