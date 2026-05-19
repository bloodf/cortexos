# Preflight: External Doc Snapshots + OpenClaw Gateway Probe

Run this prompt before any other `prompts/tools/` spoke. It verifies the OpenClaw HTTP gateway is live, confirms every required endpoint is reachable, and captures upstream documentation snapshots into `docs/external/` as read-only guides for implementors. Nothing in Phase 4c may proceed until this prompt exits cleanly.

## Todo

- [ ] Distro family detected (`CORTEX_OS_FAMILY` set)
- [ ] Supply-chain toolchain installed (cosign, syft, gh)
- [ ] OIDC identity pins exported
- [ ] CHECKPOINT 1 confirmed
- [ ] OpenClaw gateway probe recorded
- [ ] Upstream doc snapshots written under `docs/external/`
- [ ] `.secrets/.setup-state.json` updated
- [ ] CHECKPOINT 2 confirmed

> **Distro pre-step.** If `CORTEX_OS_FAMILY` is not set in your shell, run `prompts/os/00-os-selection.md` FIRST. Every subsequent tool prompt assumes the distro family is detected.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

---

## Step 0 — Supply-chain verification toolchain

The VPS must be able to verify CortexOS release artifacts. Install the toolchain and pin the OIDC identity once.

### Install cosign, syft, gh

Ubuntu / Debian:

```bash
# cosign (Sigstore)
COSIGN_VERSION="v2.4.1"
curl -fsSL "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
  -o /tmp/cosign && sudo install -m 0755 /tmp/cosign /usr/local/bin/cosign
cosign version

# syft (Anchore) — only needed to regenerate SBOMs locally
curl -fsSL https://raw.githubusercontent.com/anchore/syft/main/install.sh | \
  sudo sh -s -- -b /usr/local/bin
syft version

# gh CLI — required for SLSA build-provenance attestation verification
type gh >/dev/null 2>&1 || pkg_install gh
gh --version
```

### Pin the expected OIDC identity

Confirm the expected release identity for this repository. Export for the current shell or persist in your dotfiles:

```bash
export CORTEX_VERIFY_REPO="bloodf/cortexos"
export CORTEX_VERIFY_WORKFLOW=".github/workflows/release.yml"
export CORTEX_VERIFY_ISSUER="https://token.actions.githubusercontent.com"
```

These pins are consumed by `scripts/verify-artifact.sh`. Forks MUST override `CORTEX_VERIFY_REPO`. See [docs/SUPPLY-CHAIN.md](../../docs/SUPPLY-CHAIN.md) for the threat model and full verification protocol.

### Smoke-test the verifier (optional on first install)

If `${CORTEX_VERIFY_REPO}` already has a tagged release with a `dashboard-*`
artifact, confirm the verifier end-to-end. On a brand-new repository there is
no release yet, and this step is intentionally skipped — the dashboard image
is built locally on the VPS via `docker compose build` (`stacks/cortex-dashboard`)
and signed releases come later via `.github/workflows/release.yml`.

```bash
mkdir -p /tmp/cortex-verify && cd /tmp/cortex-verify
if gh release view --repo "$CORTEX_VERIFY_REPO" >/dev/null 2>&1; then
  gh release download --repo "$CORTEX_VERIFY_REPO" --pattern 'dashboard-*'
  "$OLDPWD/scripts/verify-artifact.sh" dashboard-*.tar.gz
else
  echo "[preflight] no release yet on $CORTEX_VERIFY_REPO — skipping artifact verification"
  echo "[preflight] this is expected on a fresh install; verification resumes once releases exist"
fi
```

Expected output (when a release exists) ends with
`[verify] OK: ... verified (checksum + cosign + SBOM + provenance)`. If a
release exists and verification fails: **HALT**. Do not proceed until the
supply-chain gate passes.

---

## CHECKPOINT 1

**STOP — operator question:** Is preflight scope understood — that OpenClaw absence is non-blocking and installed later?

1. OpenClaw is **not** required for preflight to pass. `prompts/tools/40-openclaw.md` installs it later in the graph; preflight only **detects** whether it already exists and records the result.
2. The OpenClaw probe in Step 1 is informational only — `NOT_INSTALLED` is a valid outcome and does **not** halt the install.
3. See [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md) — a spoke MUST NOT verify a service installed by a later spoke.

Type `confirmed` to proceed.

---

## Steps

### Step 1 — Detect OpenClaw gateway (informational, non-blocking)

OpenClaw is installed by `prompts/tools/40-openclaw.md` later in the graph. This step **detects** whether it is already present (e.g. from a prior install). If absent, record `NOT_INSTALLED` and continue — do **not** halt.

```bash
OPENCLAW_STATUS="NOT_INSTALLED"
if curl -fsS --max-time 5 http://127.0.0.1:18789/health >/dev/null 2>&1; then
  OPENCLAW_STATUS="present"
fi
echo "openclaw: ${OPENCLAW_STATUS}"
```

Record the result in state (see Step 5). Do not exit on `NOT_INSTALLED`.

### Step 2 — Run the gateway probe script (informational, non-blocking)

Run the probe **only if** Step 1 reported `present`. If OpenClaw is `NOT_INSTALLED`, skip Step 2 entirely — there is no gateway to probe yet — and continue to Step 3.

```bash
PROBE_EXIT_CODE="skipped"
if [ "${OPENCLAW_STATUS}" = "present" ]; then
  bash templates/scripts/probe-openclaw-gateway.sh || PROBE_EXIT_CODE="$?"
  [ "${PROBE_EXIT_CODE}" = "skipped" ] && PROBE_EXIT_CODE=0
fi
echo "probe_exit_code: ${PROBE_EXIT_CODE}"
```

Treatment of the exit code (when the probe ran):

- **Exit 0**: all required endpoints present.
- **Exit 1**: one or more required endpoints **MISSING** in an already-installed OpenClaw — record the gap and continue; `40-openclaw.md` reinstalls the latest upstream release and the probe re-runs there.
- **Exit 2**: environmental error — record and continue; do not halt preflight.

`skipped` means OpenClaw will be installed by `40-openclaw.md`.

The probe script writes its output to `docs/external/openclaw-gateway-api.snapshot.md` when it runs. That file is a guide for implementors, not a version pin. If the probe was skipped, that snapshot is regenerated by `40-openclaw.md`.

### Step 3 — Snapshot upstream documentation

For each project below, fetch the upstream README or install documentation at HEAD (default branch — never pin a SHA or tag). Write the output to the corresponding file under `docs/external/`. Use WebFetch, `curl`, or a markdown converter as available on the host.

Each snapshot file **must** begin with this exact header line:

```html
<!-- Snapshot of upstream <project> at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->
```

Replace `<project>` with the project name from the table below.

| Snapshot file | Source | Notes |
|---|---|---|
| `docs/external/openclaw-channels.snapshot.md` | OpenClaw channels/platform docs | Per-platform button and rich-block capabilities |
| `docs/external/openclaw-dreaming.snapshot.md` | OpenClaw memory-core docs | `dream` command, status flags |
| `docs/external/openclaw-openviking-install.snapshot.md` | `@openclaw/openviking` npm README | Install instructions for `npm install @openclaw/openviking@latest` |
| `docs/external/openclaw-gateway-api.snapshot.md` | Output of probe script (Step 2) | Already written by probe script — verify file exists |
| `docs/external/openclaw-a2a-gateway.snapshot.md` | `win4r/openclaw-a2a-gateway` GitHub README | Install and permissions |
| `docs/external/openclaw-compaction-context.snapshot.md` | `robertcuadra/compaction-context` GitHub README | Install instructions |
| `docs/external/openclaw-codex-watchdog.snapshot.md` | `ThisIsJeron/openclaw-codex-watchdog` GitHub README | Install instructions |
| `docs/external/openclaw-foundry.snapshot.md` | `0xRyanLucci/openclaw-foundry` GitHub README | Install instructions |
| `docs/external/9router-models.snapshot.md` | Output of `test-9router.sh` | Placeholder — captured later when 9Router is provisioned |
| `docs/external/ai-elements.snapshot.md` | Vercel AI Elements README | Component list and `npm install ai-elements@latest` instructions |

For `9router-models.snapshot.md`: write a placeholder file with the required header and the text `Pending — run test-9router.sh after 9Router is provisioned and overwrite this file.`

### Step 4 — Snapshot header enforcement

After writing each file, verify the first non-empty line starts with `<!-- Snapshot of upstream`. If any file is missing the header, prepend it before continuing.

### Step 5 — Record state

Append (or create) `.secrets/.setup-state.json` with the following structure. Merge with any existing keys — do not overwrite keys from prior runs.

```json
{
  "preflight": {
    "openclaw": "{OPENCLAW_STATUS}",
    "probe_exit_code": "{PROBE_EXIT_CODE}",
    "probe_timestamp": "{ISO8601_TIMESTAMP}",
    "snapshots": [
      "docs/external/openclaw-channels.snapshot.md",
      "docs/external/openclaw-dreaming.snapshot.md",
      "docs/external/openclaw-openviking-install.snapshot.md",
      "docs/external/openclaw-gateway-api.snapshot.md",
      "docs/external/openclaw-a2a-gateway.snapshot.md",
      "docs/external/openclaw-compaction-context.snapshot.md",
      "docs/external/openclaw-codex-watchdog.snapshot.md",
      "docs/external/openclaw-foundry.snapshot.md",
      "docs/external/9router-models.snapshot.md",
      "docs/external/ai-elements.snapshot.md"
    ]
  }
}
```

Replace `{OPENCLAW_STATUS}` with `present` or `NOT_INSTALLED`. Replace `{PROBE_EXIT_CODE}` with the exit code from Step 2 (or the literal `skipped` if OpenClaw was `NOT_INSTALLED`). Replace `{ISO8601_TIMESTAMP}` with the current UTC time. `.secrets/` is gitignored — do not commit this file.

---

## CHECKPOINT 2

**STOP — operator question:** Are all 10 snapshot files present with headers, and is preflight state recorded?

1. All 10 snapshot files exist under `docs/external/`.
   - If OpenClaw was `NOT_INSTALLED`, `openclaw-gateway-api.snapshot.md` is regenerated later by `40-openclaw.md` — it may be a placeholder here.
2. Each snapshot file starts with the required header line.
3. `.secrets/.setup-state.json` contains the `preflight` key with `openclaw` set to either `present` or `NOT_INSTALLED`.
4. `NOT_INSTALLED` is **not** a failure — it is the expected first-run state. `40-openclaw.md` installs it later.

If any condition is false: halt and fix before proceeding.

Type `confirmed` to proceed.

---

## Output

Files created or updated by this prompt:

- `docs/external/openclaw-channels.snapshot.md`
- `docs/external/openclaw-dreaming.snapshot.md`
- `docs/external/openclaw-openviking-install.snapshot.md`
- `docs/external/openclaw-gateway-api.snapshot.md`
- `docs/external/openclaw-a2a-gateway.snapshot.md`
- `docs/external/openclaw-compaction-context.snapshot.md`
- `docs/external/openclaw-codex-watchdog.snapshot.md`
- `docs/external/openclaw-foundry.snapshot.md`
- `docs/external/9router-models.snapshot.md`
- `docs/external/ai-elements.snapshot.md`
- `.secrets/.setup-state.json` (gitignored)

**Next step:** `prompts/tools/10-os-hardening.md`
