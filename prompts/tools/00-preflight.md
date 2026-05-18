# Preflight: External Doc Snapshots + OpenClaw Gateway Probe

Run this prompt before any other `prompts/tools/` spoke. It verifies the OpenClaw HTTP gateway is live, confirms every required endpoint is reachable, and captures upstream documentation snapshots into `docs/external/` as read-only guides for implementors. Nothing in Phase 4c may proceed until this prompt exits cleanly.

> **Distro pre-step.** If `CORTEX_OS_FAMILY` is not set in your shell, run `prompts/os/00-os-selection.md` FIRST. Every subsequent tool prompt assumes the distro family is detected.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

---

## Step 0 — Supply-chain verification toolchain

The operator laptop must be able to verify CortexOS release artifacts before any artifact is pushed to the VPS. Install the toolchain and pin the OIDC identity once per workstation.

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

macOS:

```bash
brew install cosign syft gh
```

### Pin the expected OIDC identity

Confirm the expected release identity for this repository. Export for the current shell or persist in your dotfiles:

```bash
export CORTEX_VERIFY_REPO="bloodf/cortexos"
export CORTEX_VERIFY_WORKFLOW=".github/workflows/release.yml"
export CORTEX_VERIFY_ISSUER="https://token.actions.githubusercontent.com"
```

These pins are consumed by `scripts/verify-artifact.sh`. Forks MUST override `CORTEX_VERIFY_REPO`. See [docs/SUPPLY-CHAIN.md](../../docs/SUPPLY-CHAIN.md) for the threat model and full verification protocol.

### Smoke-test the verifier

Download the latest release artifact and confirm the verifier works end-to-end:

```bash
mkdir -p /tmp/cortex-verify && cd /tmp/cortex-verify
gh release download --repo "$CORTEX_VERIFY_REPO" --pattern 'dashboard-*'
"$OLDPWD/scripts/verify-artifact.sh" dashboard-*.tar.gz
```

Expected output ends with `[verify] OK: ... verified (checksum + cosign + SBOM + provenance)`. If verification fails: **HALT**. Do not proceed with any installation prompt until the supply-chain gate passes.

---

## CHECKPOINT 1 — Operator: confirm OpenClaw is installed and running

Pause. Verify manually before the agent proceeds:

1. OpenClaw is installed on the target host.
2. The HTTP gateway is listening at `http://127.0.0.1:18789` (or `${OPENCLAW_BASE}` if overridden).
3. If either condition is false: **HALT**. Run `prompts/tools/40-openclaw.md` first — that prompt installs the latest upstream OpenClaw release. Return here after it completes successfully.

Operator confirms, then signals the agent to continue.

---

## Steps

### Step 1 — Verify gateway reachability

Run:

```bash
curl -sS --max-time 5 http://127.0.0.1:18789/health || echo "UNREACHABLE"
```

If the output is `UNREACHABLE` or a connection error: **HALT immediately**. Instruct the operator to run `prompts/tools/40-openclaw.md` to install and start OpenClaw before continuing.

### Step 2 — Run the gateway probe script

Run:

```bash
bash templates/scripts/probe-openclaw-gateway.sh
```

Capture the exit code.

- **Exit 0**: all required endpoints present. Proceed to Step 3.
- **Exit 1**: one or more required endpoints are **MISSING**.
  **DO NOT proceed if any required endpoint is MISSING. Contribute upstream or refactor before continuing.**
  Halt and report the missing endpoints to the operator. Do not continue to Step 3.
- **Exit 2**: environmental error (gateway not running, missing tool).
  Halt and report. Fix the environment, then restart from Step 1.

The probe script writes its output to `docs/external/openclaw-gateway-api.snapshot.md`. That file is a guide for implementors, not a version pin.

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
| `docs/external/opik-openclaw.snapshot.md` | `comet-ml/opik-openclaw` GitHub README | Install instructions |
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
    "probe_exit_code": {PROBE_EXIT_CODE},
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
      "docs/external/opik-openclaw.snapshot.md",
      "docs/external/9router-models.snapshot.md",
      "docs/external/ai-elements.snapshot.md"
    ]
  }
}
```

Replace `{PROBE_EXIT_CODE}` with the integer exit code from Step 2. Replace `{ISO8601_TIMESTAMP}` with the current UTC time. `.secrets/` is gitignored — do not commit this file.

---

## CHECKPOINT 2 — Operator: confirm probe passed and all snapshots present

Pause. Verify:

1. Step 2 exited with code **0** (all endpoints present).
2. All 11 snapshot files exist under `docs/external/`.
3. Each snapshot file starts with the required header line.
4. `.secrets/.setup-state.json` contains the `preflight` key.

If any condition is false: halt and fix before proceeding.

Operator confirms, then signals the agent to continue.

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
- `docs/external/opik-openclaw.snapshot.md`
- `docs/external/9router-models.snapshot.md`
- `docs/external/ai-elements.snapshot.md`
- `.secrets/.setup-state.json` (gitignored)

**Next step:** `prompts/tools/10-os-hardening.md`
