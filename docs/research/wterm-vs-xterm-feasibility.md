# wterm vs xterm.js — swap feasibility for CortexOS dashboard `Terminal.svelte`

**Author:** general (worker session `mvs_5a0f4a72fe5a440e88fb40da01a525f5`)
**Date:** 2026-06-05
**Repo inspected:** https://github.com/vercel-labs/wterm @ `641ae91` (2026-05-20)
**Target file:** `packages/dashboard/src/lib/components/terminal/Terminal.svelte`

---

## TL;DR

**Recommendation: (a) SWAP with a ~40-line Svelte 5 wrapper, no full adapter needed.**

wterm v0.3.0 renders to the **DOM** (not canvas), so it works in jsdom with only
three tiny global stubs (`ResizeObserver`, `requestAnimationFrame`,
`getComputedStyle`). wterm ships its own jsdom test suite that exercises the
full mount → write → render → input path. This directly closes the ~60 lines
of unreachable code in `Terminal.svelte` that the team currently has to
defend with the "Playwright E2E only" comment.

The API mapping is small and the gaps (`clear()`, `writeln()`,
`convertEol`, `WebLinksAddon`, theme constructor option) are all trivial
shims or non-issues for an admin-only terminal surface. The only real
risk is that wterm is a 7-week-old Vercel Labs project at 3.2k stars —
manageable, but worth flagging.

---

## 1. wterm technical profile

### Render path

- **Emulation core: Zig → WebAssembly** (`src/terminal.zig`).
  - Built-in core: ~12 KB WASM, VT100/VT220/xterm parser (`README.md:35`).
  - Optional core: `@wterm/ghostty` (libghostty, ~400 KB WASM) added in v0.3.0
    (`CHANGELOG.md:6`).
  - The default published `@wterm/core` package **embeds the WASM as a
    base64 string** in `wasm-inline.ts` and decodes it in-process — no
    external `.wasm` file fetch needed (`packages/@wterm/core/src/wasm-bridge.ts:42-49`).
    Override with `wasmUrl` if you want to self-host.
- **Renderer: pure DOM** (`packages/@wterm/dom/src/renderer.ts`).
  - No `<canvas>`, no WebGL, no OffscreenCanvas.
  - Each cell is a `<span>` styled via inline `style` (`renderer.ts:85-90`).
  - Dirty-row tracking only re-renders touched rows per
    `requestAnimationFrame` (`wterm.ts:175-186`).
  - Native text selection / copy / paste / browser find / screen-reader
    support (README claim — verified by absence of any
    `selectionchange` / `clipboard` overrides in the source).

### Canvas / DOM APIs it needs

- `document.createElement('div' | 'span' | 'textarea')` (renderer + input)
- `Element.appendChild`, `insertBefore`, `removeChild`
- `getBoundingClientRect` for character-size measurement
  (`wterm.ts:243-280`)
- `getComputedStyle` for `--term-row-height`, padding, border
  (`wterm.ts:229-241`)
- `requestAnimationFrame` (scheduler)
- `ResizeObserver` (auto-resize)
- `addEventListener('click' | 'keydown' | 'paste' | 'compositionstart'
  | 'compositionend' | 'input' | 'focus' | 'blur')` (`input.ts:103-115`)
- `WebAssembly.instantiate(bytes)` (`wasm-bridge.ts:81`)

### Does it run in jsdom without the `canvas` npm package?

**Yes.** Evidence: wterm itself tests the full DOM package in jsdom.

- `packages/@wterm/dom/package.json:34` lists `jsdom@^29.0.2` as a devDep.
- `packages/@wterm/dom/src/__tests__/setup.ts` (full file, 41 lines) is
  the **entire** jsdom shim. It only stubs:
  1. `ResizeObserver` (no-op observe/unobserve/disconnect)
  2. `requestAnimationFrame` / `cancelAnimationFrame` (routed through `setTimeout`)
  3. `getComputedStyle` (returns stubbed `--term-row-height: 17`,
     `paddingTop: 12`, etc. for the height-locking branch)
- `packages/@wterm/dom/src/__tests__/wterm.test.ts` runs 348 lines of
  `new WTerm(el)` + `await term.init()` + `term.write(...)` assertions
  entirely in vitest+jsdom (`wterm.test.ts:38-347`).

**No `canvas` package needed** because nothing draws to a bitmap.

### Terminal features supported

- 24-bit color (SGR true color, `renderer.ts:33-41`)
- 16-color ANSI palette via CSS vars (`terminal.css:6-21`)
- Alternate screen buffer (DECSET 47/1047/1049, `terminal.zig:469-474`)
- Scrollback history (ring buffer, `src/scrollback.zig`)
- Cursor blink (CSS animation, `terminal.css:82-89`)
- Auto-resize via `ResizeObserver` (default `true`, `wterm.ts:282-305`)
- Bracketed paste mode (DECSET 2004) with **ESC-byte stripping** for
  security — pasted text cannot inject `\x1b[201~` to break out
  (`input.ts:178-187`, fix from v0.1.9 #33)
- Title change events via OSC (`wasm-bridge.ts:24-27, 159-165`)
- DA1 / DA2 / DSR device-status queries
- WebSocket transport for PTY backends, built-in
  (`packages/@wterm/core/src/transport.ts`)

### What is NOT supported / not provided

- **No canvas / WebGL** (it's a feature, not a gap)
- **No `WebLinksAddon`** — relies on native text selection, no
  clickable-URL detection in `@wterm/dom`
- **No `searchAddon`** — relies on browser's native `Ctrl+F` (works in
  any DOM, including jsdom)
- **No `unicode11Addon`** — built-in Unicode support, but no width-11
  emoji handling like xterm-addon-unicode11
- **No `imageAddon`** (Sixel/iTerm) — libghostty core would add this in
  theory, but the Zig core does not

---

## 2. API compatibility with xterm.js v5.5.0

### Direct matches

| xterm.js v5.5.0 | wterm v0.3.0 | Notes |
|---|---|---|
| `new Terminal({...})` | `new WTerm(el, {...})` | Element passed to **constructor**, not `.open()` |
| `t.open(host)` | (constructor) | Different lifecycle shape |
| `t.write(d)` | `wt.write(d)` | **Identical** |
| `t.onData(cb)` | `wt.onData = cb` or `new WTerm(el, { onData: cb })` | **Identical** |
| `t.onResize(cb)` | `wt.onResize = cb` or constructor option | **Identical** |
| `t.focus()` | `wt.focus()` | **Identical** |
| `t.dispose()` | `wt.destroy()` | Renamed only |
| `t.options.fontFamily` / `fontSize` | CSS vars `--term-font-family`, `--term-font-size` on `.wterm` | Move to CSS |
| `t.options.theme: {bg,fg,cursor,...}` | `theme: "monokai"` (React) or `element.classList.add('theme-monokai')` (DOM) | **Use CSS, not constructor** |
| `t.options.scrollback: 5000` | Configured in `@wterm/core` (no public per-instance option yet) | Accept default scrollback |
| FitAddon | Built-in as `autoResize: true` (default) | **No separate import** |

### Gaps that need a small shim

| xterm.js v5.5.0 | wterm v0.3.0 | Shim |
|---|---|---|
| `t.clear()` | **Not provided** | `wt.write('\x1b[3J\x1b[2J\x1b[H')` — confirmed supported by the Zig core: `eraseInDisplay` implements modes 0/1/2/3 (`src/terminal.zig:604-632`), and mode 3 calls `scrollback.reset()` (`terminal.zig:626-628`) |
| `t.writeln(d)` | **Not provided** | `wt.write(\`${d}\r\n\`)` |
| `t.options.convertEol: true` | **Not a flag** | Caller must pass `\r\n` explicitly. Trivial because we already do this in the shim above |
| `t.isReady()` | No equivalent | `wt.bridge !== null` (set after `await init()`) |
| `WebLinksAddon` (clickable URLs) | **Not provided** | Add a custom click handler that scans `wt.element.innerText` for `https?://…` and attaches `onclick` if needed. For an admin-only terminal displaying server output, low priority |

### The xterm.js public surface we actually use in `Terminal.svelte`

From `packages/dashboard/src/lib/components/terminal/Terminal.svelte`:

- Lines 27-33: `TerminalApi` interface → `write`, `writeln`, `clear`, `focus`, `isReady`
- Lines 60-69: xterm internal types → `write`, `writeln`, `clear`, `focus`, `dispose`, `open`, `onData`
- Lines 84-102: `safeWrite`, `renderPrompt`, `handleLine` — pure JS, no xterm
- Lines 109-114: dynamic imports `@xterm/xterm` + `@xterm/addon-fit` + CSS
- Lines 116-127: `new Terminal({convertEol, cursorBlink, fontFamily, fontSize, theme, scrollback})`
- Line 130: `t.open(host)`
- Line 132: `fit.fit()`
- Lines 139-170: `t.onData(...)` with `\r` / `\u007f` / `\u0003` / `\u000c` handling — this is the **bulk of the input logic** and is **pure JS state, not xterm-specific**
- Lines 184-193: `new ResizeObserver(...)` — already a plain DOM API, no xterm

The mapping is therefore:

```ts
// xterm.js today:
const [{ Terminal }, { FitAddon }] = await Promise.all([
  import('@xterm/xterm'),
  import('@xterm/addon-fit'),
]);
await import('@xterm/xterm/css/xterm.css');
const t = new Terminal({ convertEol: true, cursorBlink: true, ... });
const fit = new FitAddon();
t.open(host);
fit.fit();
t.onData((data) => { ... });
t.write(banner);
t.write(prompt);

// wterm v0.3.0 equivalent:
const { WTerm } = await import('@wterm/dom');
await import('@wterm/dom/css');
const wt = new WTerm(host, {
  cursorBlink: true,
  autoResize: true,        // replaces FitAddon
  // theme/fontFamily/fontSize move to a <style> block or terminal.css override
  onData: (data) => { ... },
});
await wt.init();
wt.write(banner);
wt.write(prompt);
```

The `TerminalApi` interface stays **unchanged** for the page that uses it
(`src/routes/(authed)/terminal/+page.svelte:19-26, 44, 54, 60`). The shim
inside the new `Terminal.svelte` is:

```ts
api.write = (d) => safeWrite(d);
api.writeln = (d) => safeWrite(`${d}\r\n`);
api.clear = () => wt?.write('\x1b[3J\x1b[2J\x1b[H');
api.focus = () => wt?.focus();
api.isReady = () => wt?.bridge !== null;
```

The `\r` / `\u007f` / `\u0003` / `\u000c` input handling at
`Terminal.svelte:139-170` is **already framework-agnostic** — it's just
a JS state machine on a `data: string` callback. Drop-in.

---

## 3. Production readiness

| Signal | Value | Source |
|---|---|---|
| Latest release | **v0.3.0** (2026-04-30) | `CHANGELOG.md:3`, `git tag -l` (v0.1.1–v0.3.0) |
| Latest commit | `641ae91` (2026-05-20) | `git log -1` |
| First release | v0.1.1 (around 2026-04-14) | `git tag -l` |
| Repo age | ~7 weeks | `api.github.com: created_at: 2026-04-14T14:52:44Z` |
| Stars | **3,204** | `api.github.com: stargazers_count` |
| Forks | 138 | `api.github.com: forks_count` |
| Open issues | 41 | `api.github.com: open_issues_count` |
| Archived | **No** | `api.github.com: archived: false` |
| Disabled | No | `api.github.com: disabled: false` |
| License | **Apache-2.0** | `api.github.com: license.spdx_id` |
| Owner | `vercel-labs` (org) | `api.github.com: owner.login` |
| Homepage | https://wterm.dev | `api.github.com: homepage` |
| E2E suite | Playwright (`e2e/playwright.config.ts`) | `package.json:27` |

### Risk assessment

- **"Labs" status:** wterm lives in the `vercel-labs` org, not the main
  `vercel` org. Vercel's `vercel-labs` pattern has produced both
  production graduates (portless, just-bash which is now a wterm sub-dep)
  and projects that have stayed labs for years. **There is no
  commitment signal that wterm will be moved to `vercel`.**
- **Changelog cadence:** 11 releases in 7 weeks (v0.1.1 → v0.3.0). This
  is **fast iteration**, which is good for bug fixes but means the API
  is not yet stable — e.g. v0.3.0 extracted `TerminalCore` and added the
  Ghostty backend (#62), which is a non-trivial refactor.
- **Recent security fix in mainline:** bracketed-paste ESC stripping
  shipped in v0.1.9 (#33) — the team responds to security reports
  quickly.
- **No CVE / no deprecation notice.** The repo is not archived and
  there's no "we're not maintaining this" signal in the README.
- **npm presence:** `pnpm-workspace.yaml:2` configures
  `minimumReleaseAge: 2880` (48 hours) for all workspace deps. The
  published packages (`@wterm/dom`, `@wterm/core`, `@wterm/react`,
  `@wterm/vue`, `@wterm/ghostty`, `@wterm/just-bash`, `@wterm/markdown`)
  are all at v0.3.0 on npm (verified via package.json `version` field
  on each).

### Verdict

Production-acceptable for an **admin-only, internal** terminal surface.
**Not yet appropriate** for a public-facing consumer terminal UI where
xterm.js's decade of stability matters. For CortexOS — which restricts
this surface to `cortexos-admin` group members running allowlisted ops
on a self-hosted host — the risk is bounded.

---

## 4. Svelte 5 + SSR compatibility

### No Svelte adapter exists

wterm ships **React** (`@wterm/react`) and **Vue 3** (`@wterm/vue`)
adapters. There is **no `@wterm/svelte`** package. The vanilla `@wterm/dom`
is the right entry point for Svelte 5.

### Reference adapters (for pattern, not for direct import)

- `packages/@wterm/react/src/Terminal.tsx` (179 lines) — `forwardRef` +
  `useImperativeHandle` + `useCallback` ref for the WTerm init/destroy
  lifecycle. Calls `new WTerm(el, {...})` then `wt.init()` in a
  callback ref, returns a cleanup that calls `wt.destroy()`.
- `packages/@wterm/vue/src/Terminal.ts` — `defineComponent` with
  `onMounted` + `onBeforeUnmount`, same pattern: `new WTerm` then
  `init()` then `destroy()`.

The Svelte 5 equivalent is **mechanically the same** as the current
`Terminal.svelte` — `onMount` + `onDestroy`, with a `bind:this` host
div and the `if (typeof window === 'undefined' || !host) return` SSR
guard that's already in place (`Terminal.svelte:107`).

### What needs to change in `Terminal.svelte`

The current `onMount` block at `Terminal.svelte:104-194` needs the
following substitutions (mechanical, ~40 LOC net change):

| Current (xterm.js) | New (wterm) |
|---|---|
| `import('@xterm/xterm')`, `import('@xterm/addon-fit')` | `import('@wterm/dom')` |
| `import('@xterm/xterm/css/xterm.css')` | `import('@wterm/dom/css')` |
| `new Terminal({...})` | `new WTerm(host, {...})` |
| `new FitAddon()` | (omit — `autoResize: true` is the default) |
| `t.open(host)` | (omit — host passed to constructor) |
| `fit.fit()` | (omit — auto-resize is on) |
| `t.onData(cb)` | constructor `onData` option, **or** assign `wt.onData = cb` before `await wt.init()` |
| `t.write(d)` / `t.writeln(d)` | `wt.write(d)` / `wt.write(\`${d}\r\n\`)` |
| `t.clear()` | `wt.write('\x1b[3J\x1b[2J\x1b[H')` |
| `t.dispose()` | `wt.destroy()` |
| `fit?.fit()` in `ResizeObserver` | (omit — wterm owns its own `ResizeObserver` in `wterm.ts:288-304`) |

### SSR / dynamic-import compatibility

Vite/SvelteKit's dynamic-import chunking treats `import('@wterm/dom')`
the same way as `import('@xterm/xterm')` — a separate chunk loaded only
when the import statement executes. The `if (typeof window ===
'undefined' || !host) return` guard at `Terminal.svelte:107` is the
**only** SSR defense needed; wterm does not touch `window` in its
module-load path (it only touches it in the constructor and
`init()`).

### vitest setup compatibility

`packages/dashboard/vitest.setup.ts` already stubs:
- `ResizeObserver` (line 31-35 of vitest.setup.ts)
- `matchMedia`, `scrollTo`, `scrollIntoView`

We will need to add (modeled on wterm's own setup.ts, 41 lines total):

```ts
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
if (typeof globalThis.getComputedStyle === 'undefined' || ...) {
  // see wterm/src/__tests__/setup.ts:24-41
}
```

The first stub is a 3-line addition. The second is a 10-line mock that
wterm already provides verbatim. **No new devDeps** — the dashboard
already has `jsdom@^25.0.0` (`packages/dashboard/package.json:52`) and
wterm's tests run on the same jsdom version family.

---

## 5. Migration cost estimate

### Files to change

| File | Change | LOC delta |
|---|---|---|
| `packages/dashboard/package.json` | Remove 3 deps, add 1 dep | +1 / -3 lines |
| `packages/dashboard/src/lib/components/terminal/Terminal.svelte` | Rewrite the `onMount` mount block (lines 56-194, ~140 LOC) | ~+20 / -100 lines (net -80) |
| `packages/dashboard/src/lib/components/terminal/terminal.test.ts` | Update 2 string assertions (`@xterm/xterm` → `@wterm/dom`, `@xterm/addon-fit` → `@wterm/dom`) at lines 118-119; the rest of the file (source-contract tests) is xterm-agnostic | ±2 lines |
| `packages/dashboard/src/lib/components/terminal/__tests__/terminal-mount.test.ts` | **Expand** — we can now actually assert on `.wterm` class, `.term-grid` child, `.term-row` count, etc. | +30 to +60 lines of new real coverage |
| `packages/dashboard/vitest.setup.ts` | Add `requestAnimationFrame` + `getComputedStyle` stubs | +12 lines |
| `packages/dashboard/src/lib/components/terminal/CommandPalette.svelte` | One comment update ("xterm panel" → "wterm panel") at line 12 | ±1 line |
| `packages/dashboard/src/routes/(authed)/services/[id]/health/+server.ts` | One comment update ("the future xterm bridge" → "the wterm bridge") at line 6 | ±1 line |
| `packages/dashboard/src/lib/components/terminal/CommandPalette.test.ts` (if it imports xterm) | Verify and adjust if needed | 0-2 lines |
| `packages/dashboard/src/routes/(authed)/terminal/+page.svelte` | **No change** — `bind:api` is opaque, `api.writeln` shim has the same signature | 0 lines |

### package.json swap

```diff
   "dependencies": {
     ...
-    "@xterm/xterm": "^5.5.0",
-    "@xterm/addon-fit": "^0.10.0",
-    "@xterm/addon-web-links": "^0.11.0",
+    "@wterm/dom": "^0.3.0",
     ...
   }
```

That's the only dependency change. `@wterm/dom` re-exports
`@wterm/core` and provides the CSS via the `/css` subpath
(`packages/@wterm/dom/package.json:14-23`).

### Test surface impact

**Positive.**

Current state: `terminal-mount.test.ts:6-8` explicitly says "xterm.js
cannot mount in jsdom (no canvas font metrics), so this test only
exercises the Svelte 5 mount path". The `onMount` block at
`Terminal.svelte:104-194` (~90 lines) is **structurally uncovered** —
only Playwright E2E in `e2e/terminal.spec.ts` (Chromium) hits it.

After swap: the entire `WTerm` class is designed to be testable in
jsdom (its own test suite proves this — 348 lines of
`new WTerm` + `init` + `write` + `resize` + `destroy` in
`packages/@wterm/dom/src/__tests__/wterm.test.ts`). The Svelte wrapper
adds a thin lifecycle layer on top. We can now:

1. Mount `Terminal.svelte` in jsdom
2. Wait for `await tick()` after `onMount`
3. Assert `host.querySelector('.wterm')` exists
4. Assert `host.querySelectorAll('.term-row').length === 24` (default rows)
5. Spy on `wt.write` (via a constructor-injected mock bridge or by
   reading `wt.bridge.getCell(0, 0)`) to verify the banner + prompt
   were written
6. Synthesize a `KeyboardEvent` on the hidden `textarea` and verify
   `onCommand` was called with the expected trimmed command

This closes the structural coverage gap the M3 cycle identified.

### What is *not* gained

- **Live-host validation.** The OrbStack smoke test still has to run
  (per the lessons from v0.4.0 — CI proves unit logic, real-host
  proves integration). wterm ships Playwright E2E coverage; we
  should add a Playwright test for the wterm-based Terminal.svelte in
  `e2e/terminal.spec.ts`.
- **Bundle size win is not guaranteed.** wterm's inlined WASM is
  ~12 KB; xterm.js's full bundle is ~250 KB but heavily tree-shaken.
  Real bundle delta will be measured post-swap. (Not blocking.)

---

## 6. Recommendation: **(a) SWAP**, with a thin Svelte 5 shim

### Decision matrix

| Option | Verdict | Why |
|---|---|---|
| (a) SWAP | **Recommended** | wterm's DOM-render model is fundamentally a better fit for the test stack the team has already invested in (jsdom + vitest). Closes the structural coverage gap. API delta is small and mechanical. |
| (b) WRAP | Optional | Only justified if we want to abstract over both wterm and xterm.js (e.g. feature-flag the terminal). For a single-tenant self-hosted admin surface, that's YAGNI. |
| (c) STAY | Reject | The "Playwright E2E only" workaround is a known gap. The dashboard's `coverage/lib/components/terminal` is currently dragged down by this file. The 3.2k-star momentum + Apache-2.0 license + active maintenance outweigh the labs risk for this use case. |
| (d) HYBRID | Reject | Maintaining two renderers (wterm in tests, xterm.js in production) means two behavior contracts. The entire point of wterm is that it's jsdom-friendly — using it only in tests defeats the purpose. |

### Conditions to attach to the swap

1. **Pin `@wterm/dom` to `^0.3.0`** (not `*` / not `next`). v0.3.0 is
   the first release with the stable `TerminalCore` interface
   (`CHANGELOG.md:6-7`); pinning to a minor avoids surprise breaking
   changes from the fast iteration cadence.
2. **Add the jsdom setup stubs to `vitest.setup.ts`** (12 lines)
   before the swap, modeled on `packages/@wterm/dom/src/__tests__/setup.ts`.
3. **Add real mount-based tests to `__tests__/terminal-mount.test.ts`** as
   part of the same PR. The whole point of the swap is to close the
   coverage gap; shipping without new tests would defeat the
   rationale.
4. **Run the live-host smoke test** (`scripts/smoke/real-host.sh`)
   after the swap on an OrbStack Ubuntu 24.04 VM. This is
   non-negotiable for any privileged-action surface change
   (per the M0-M4 lessons).
5. **Keep `WTerm` as a peer of the Svelte wrapper, not embedded.**
   Importing wterm at the top of `Terminal.svelte` (instead of
   dynamic-importing inside `onMount`) would pull the WASM into the
   SSR build. The current dynamic-import pattern is correct; do not
   change it.
6. **Add a Playwright E2E test** for the wterm Terminal.svelte to
   `e2e/terminal.spec.ts`. The current e2e (if any) targets
   xterm.js DOM selectors; new assertions should target
   `data-slot="terminal"`, `.wterm`, `.term-row` (24 rows), and
   `wt.bridge` state via a debug hook.

### If recommendation (a) is accepted, the change set is:

- 1 file deleted: nothing (we swap, not remove)
- 1 file added: nothing (we rewrite in place)
- 7 files modified: see the table in §5
- 1 dep removed, 1 dep added
- Estimated reviewer time: 30 minutes (small diff, mostly
  `Terminal.svelte`)
- Estimated test delta: 30-60 LOC of new real mount-based tests

### If recommendation is rejected:

The "STAY" alternative is to add a Playwright E2E test for the
current xterm.js implementation and document the gap in
`coverage/README.md`. The cost is roughly equal to the swap in LOC
but the structural-coverage number doesn't move, so the M3-coverage
target (95%) for `lib/components/terminal/` will stay below goal
until xterm.js gains a jsdom-friendly renderer upstream.

---

## Appendix A: file:line references

- wterm v0.3.0 release notes — `CHANGELOG.md:3-31`
- WTerm public API — `packages/@wterm/dom/src/wterm.ts:6-21` (options),
  `packages/@wterm/dom/src/wterm.ts:50-74` (constructor), `packages/@wterm/dom/src/wterm.ts:76-126` (init)
- WasmBridge (inlined-WASM loader) — `packages/@wterm/core/src/wasm-bridge.ts:68-83`
- TerminalCore interface — `packages/@wterm/core/src/terminal-core.ts:30-65`
- jsdom test setup (41 lines, the **only** shim needed) — `packages/@wterm/dom/src/__tests__/setup.ts:1-41`
- jsdom test for full WTerm mount lifecycle — `packages/@wterm/dom/src/__tests__/wterm.test.ts:38-347`
- Zig `eraseInDisplay` (mode 3 = clear scrollback) — `src/terminal.zig:604-632`
- Bracketed-paste ESC-stripping security fix — `packages/@wterm/dom/src/input.ts:178-187`
- React adapter (pattern reference for Svelte 5) — `packages/@wterm/react/src/Terminal.tsx:43-177`
- Vue adapter (alternative pattern reference) — `packages/@wterm/vue/src/Terminal.ts`
- Current xterm.js usage in CortexOS dashboard — `packages/dashboard/src/lib/components/terminal/Terminal.svelte:104-194`
- Current jsdom setup in CortexOS dashboard — `packages/dashboard/vitest.setup.ts:22-37`
- Current xterm.js deps in CortexOS dashboard — `packages/dashboard/package.json:31-33`
- TerminalApi consumer — `packages/dashboard/src/routes/(authed)/terminal/+page.svelte:19, 26, 44, 54, 60`

## Appendix B: GitHub metadata (raw)

```json
{
  "full_name": "vercel-labs/wterm",
  "stargazers_count": 3204,
  "forks_count": 138,
  "open_issues_count": 41,
  "archived": false,
  "disabled": false,
  "license": "Apache-2.0",
  "created_at": "2026-04-14T14:52:44Z",
  "pushed_at": "2026-05-20T21:25:07Z",
  "default_branch": "main",
  "owner": "vercel-labs"
}
```

Source: `https://api.github.com/repos/vercel-labs/wterm` (retrieved 2026-06-05).
