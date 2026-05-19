# Supply Chain Security

> CortexOS releases ship with SLSA L2 build provenance, keyless cosign signatures, and SPDX SBOMs. This document specifies the verification protocol, trust roots, and threat model.

## Goals

- **Provenance** — every release artifact ties back to a specific GitHub Actions workflow run on a specific commit.
- **Integrity** — operators detect tampering between GitHub Releases and the VPS.
- **Transparency** — every signature is logged to a public transparency log (Rekor); tamper attempts are publicly auditable.
- **Bill of materials** — every artifact ships with a signed SPDX SBOM listing transitive components.

## Trust roots

CortexOS uses the **Sigstore public-good instance** with no custom CA pinning:

| Component | URL | Role |
|---|---|---|
| Fulcio | `https://fulcio.sigstore.dev` | Short-lived (≈10 min) signing certs bound to OIDC identity |
| Rekor | `https://rekor.sigstore.dev` | Append-only transparency log for every signature |
| OIDC issuer (CortexOS releases) | `https://token.actions.githubusercontent.com` | GitHub Actions OIDC provider |
| Expected identity | `https://github.com/${CORTEX_VERIFY_REPO:-cortexos/cortexos}/.github/workflows/${CORTEX_VERIFY_WORKFLOW:-release.yml}@<ref>` | Workflow + ref that produced the signature |

The operator MUST pin the OIDC identity. A valid Sigstore signature with the wrong identity proves nothing about CortexOS.

`scripts/verify-artifact.sh` pins identity via `--certificate-identity-regexp` and the issuer via `--certificate-oidc-issuer`. Override with `CORTEX_VERIFY_REPO`, `CORTEX_VERIFY_WORKFLOW`, and `CORTEX_VERIFY_ISSUER` env vars for forks.

## Artifact layout

For each release tag `vX.Y.Z`, GitHub Releases publishes for every artifact `<name>`:

| File | Purpose |
|---|---|
| `<name>-vX.Y.Z.tar.gz` | Source tarball |
| `<name>-vX.Y.Z.tar.gz.sha256` | SHA-256 checksum |
| `<name>-vX.Y.Z.tar.gz.sig` | cosign signature (base64) |
| `<name>-vX.Y.Z.tar.gz.pem` | Fulcio short-lived signing certificate |
| `<name>-vX.Y.Z.sbom.spdx.json` | syft-generated SPDX SBOM |
| `<name>-vX.Y.Z.sbom.spdx.json.sig` | cosign signature of the SBOM |
| `<name>-vX.Y.Z.sbom.spdx.json.pem` | Fulcio cert for the SBOM signature |

Artifacts in scope:

- `cortex-paperclip-bridge`
- `cortex-consumer`
- `dashboard`
- `paperclip-adapter`
- `cortex-graph` *(included when present)*

All artifact references above use `$CORTEX_VERIFY_REPO` so forks can override the source repository without editing this file.

SLSA L2 build-provenance attestations are attached via the GitHub Attestations API (`actions/attest-build-provenance@v2`). Verify with `gh attestation verify`.

## Verification protocol (operator laptop)

Run **before** pushing artifacts to a VPS. Do not skip on "trusted" networks.

```bash
# 1. Download tarball + all sidecars from the GitHub release.
gh release download vX.Y.Z --repo "$CORTEX_VERIFY_REPO" --pattern 'dashboard-*'

# 2. Verify (hard-fails on any mismatch).
scripts/verify-artifact.sh dashboard-vX.Y.Z.tar.gz --ref refs/tags/vX.Y.Z
```

The script performs four checks:

1. **SHA-256** — matches `.sha256` sidecar.
2. **cosign verify-blob** — tarball signature chain back to Fulcio + Rekor, identity pinned to `release.yml` on the expected repo.
3. **cosign verify-blob (SBOM)** — same identity verification for the SPDX SBOM.
4. **`gh attestation verify`** — SLSA L2 build provenance attestation. Skipped with a warning if `gh` is not installed; install for full L2 verification.

If any check fails: **HALT**. Do not deploy. Treat as compromise until proven otherwise.

## Prerequisites

Install on the operator laptop:

- [cosign](https://docs.sigstore.dev/cosign/installation/) v2+
- [syft](https://github.com/anchore/syft#installation) (only required to regenerate SBOMs locally)
- [gh CLI](https://cli.github.com/) (required for `gh attestation verify`)

## Threat model

| Threat | Control | Residual risk |
|---|---|---|
| Attacker rewrites GitHub Release assets | cosign signature + Rekor log — tarball cannot be re-signed without GitHub OIDC token in the workflow run | Rekor log compromise (mitigated by Sigstore monitors); short-lived Fulcio certs limit replay |
| Attacker compromises a maintainer laptop | No private keys exist on maintainer machines (keyless). Only release.yml triggered by tag push can produce a valid identity. | Maintainer with `contents: write` could push a malicious tag — mitigated by branch protection + required reviews |
| Attacker tampers in transit (laptop → VPS) | SHA-256 + cosign verified on laptop pre-upload; `install.sh` re-runs `verify-artifact.sh` as a deploy gate | Mitigated end-to-end if the operator runs the gate |
| Malicious dependency in build | syft SBOM lists every transitive component; SBOM is itself signed | SBOM does not block install; operators must review SBOM diffs across releases for unexpected components |
| Sigstore public-good outage | Rekor + Fulcio public-good is the only trust root. No fallback. | Releases pause until Sigstore recovers; no insecure fast-path |
| Replay of an old signed artifact | OIDC identity includes the workflow ref (tag). Operator pins `--ref` to the exact tag. | Operator who omits `--ref` accepts any signed CortexOS release — document recommends pinning |

## Build provenance: what SLSA L2 guarantees

- **L1: Documented build process** — `release.yml` is checked in, reviewable, immutable post-tag.
- **L2: Tamper-resistant build service** — GitHub-hosted runners + GitHub's attestations service sign the provenance statement with GitHub's keyless identity, bound to the workflow run ID.

The provenance attestation answers: *which commit, which workflow run, which runner, which inputs produced this artifact?* Verifiable with `gh attestation verify` against the Sigstore public-good Rekor instance.

L3 (isolated, signed build service) is **out of scope** — it requires reusable workflows + builder pinning that we will revisit in a later phase.

## Operator workflow integration

`scripts/verify-artifact.sh` is invoked from:

- `prompts/tools/00-preflight.md` — preflight installs cosign + syft + gh and pins identity.
- `prompts/tools/70-dashboard.md` — verify dashboard tarball before native build.
- `templates/cortex-orchestration/install.sh` — verify orchestration tarball before install.

## Rotating trust roots

CortexOS does not pin Fulcio/Rekor URLs to non-default values. Sigstore public-good rotates root keys via TUF; cosign fetches the current root automatically. If CortexOS ever moves to a private Sigstore instance, this document and `scripts/verify-artifact.sh` must be updated together — never one without the other.
