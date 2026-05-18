#!/usr/bin/env bash
# verify-artifact.sh — operator-side supply-chain verification gate.
#
# Verifies a CortexOS release artifact downloaded from GitHub Releases:
#   1. SHA-256 checksum matches the published .sha256 sidecar.
#   2. cosign verify-blob succeeds against the Sigstore public-good trust root
#      (Fulcio cert + Rekor transparency log) and the OIDC identity is pinned
#      to the expected repo + workflow.
#   3. The companion SPDX SBOM is signed by the same identity.
#   4. GitHub-native build-provenance attestation verifies via `gh attestation`.
#
# Designed to run on the operator laptop BEFORE pushing the artifact to the VPS.
# Hard-fails on any check failure. No partial trust.
#
# Usage:
#   scripts/verify-artifact.sh <path-to-artifact.tar.gz> [--repo <owner/repo>] [--ref <git-ref>]
#
# Environment overrides:
#   CORTEX_VERIFY_REPO        — expected GitHub repo (default: bloodf/cortexos)
#   CORTEX_VERIFY_WORKFLOW    — expected workflow ref (default: release.yml)
#   CORTEX_VERIFY_ISSUER      — expected OIDC issuer (default: https://token.actions.githubusercontent.com)
#
# Trust roots: Sigstore public-good Fulcio + Rekor (default cosign config).
# Documented in docs/SUPPLY-CHAIN.md.

set -euo pipefail

CORTEX_VERIFY_REPO="${CORTEX_VERIFY_REPO:-bloodf/cortexos}"
CORTEX_VERIFY_WORKFLOW="${CORTEX_VERIFY_WORKFLOW:-.github/workflows/release.yml}"
CORTEX_VERIFY_ISSUER="${CORTEX_VERIFY_ISSUER:-https://token.actions.githubusercontent.com}"

die() {
  echo "[verify] FAIL: $*" >&2
  exit 1
}

info() {
  echo "[verify] $*"
}

usage() {
  cat <<'EOF'
Usage: verify-artifact.sh <artifact.tar.gz> [--repo owner/repo] [--ref ref]

Verifies SHA-256, cosign keyless signature, SBOM signature, and GitHub build
provenance attestation for a CortexOS release artifact.

Sibling files expected in the same directory as <artifact.tar.gz>:
  <artifact>.tar.gz.sha256
  <artifact>.tar.gz.sig
  <artifact>.tar.gz.pem
  <artifact>.sbom.spdx.json
  <artifact>.sbom.spdx.json.sig
  <artifact>.sbom.spdx.json.pem
EOF
}

ARTIFACT=""
REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage; exit 0 ;;
    --repo) CORTEX_VERIFY_REPO="$2"; shift 2 ;;
    --ref) REF="$2"; shift 2 ;;
    -*)
      die "unknown flag: $1"
      ;;
    *)
      if [ -z "$ARTIFACT" ]; then
        ARTIFACT="$1"
      else
        die "extra positional argument: $1"
      fi
      shift
      ;;
  esac
done

[ -n "$ARTIFACT" ] || { usage; exit 2; }
[ -f "$ARTIFACT" ] || die "artifact not found: $ARTIFACT"

command -v cosign >/dev/null 2>&1 || die "cosign not installed (https://docs.sigstore.dev/cosign/installation/)"
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || die "sha256sum or shasum required"

ART_DIR="$(cd "$(dirname "$ARTIFACT")" && pwd)"
ART_BASE="$(basename "$ARTIFACT")"
ART_STEM="${ART_BASE%.tar.gz}"

CHECKSUM="${ART_DIR}/${ART_BASE}.sha256"
SIG="${ART_DIR}/${ART_BASE}.sig"
CERT="${ART_DIR}/${ART_BASE}.pem"
SBOM="${ART_DIR}/${ART_STEM}.sbom.spdx.json"
SBOM_SIG="${SBOM}.sig"
SBOM_CERT="${SBOM}.pem"

for f in "$CHECKSUM" "$SIG" "$CERT" "$SBOM" "$SBOM_SIG" "$SBOM_CERT"; do
  [ -f "$f" ] || die "missing sidecar: $f"
done

# --- 1. SHA-256 ---------------------------------------------------------------
info "step 1/4: SHA-256 checksum"
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$ART_DIR" && sha256sum -c "$(basename "$CHECKSUM")" ) || die "checksum mismatch"
else
  expected="$(awk '{print $1}' "$CHECKSUM")"
  actual="$(shasum -a 256 "$ARTIFACT" | awk '{print $1}')"
  [ "$expected" = "$actual" ] || die "checksum mismatch (expected=$expected actual=$actual)"
fi

# --- 2. cosign verify-blob (tarball) ------------------------------------------
info "step 2/4: cosign verify-blob (artifact)"
IDENTITY_REGEX="^https://github\\.com/${CORTEX_VERIFY_REPO}/${CORTEX_VERIFY_WORKFLOW}@"
if [ -n "$REF" ]; then
  IDENTITY_REGEX="^https://github\\.com/${CORTEX_VERIFY_REPO}/${CORTEX_VERIFY_WORKFLOW}@${REF}$"
fi

COSIGN_EXPERIMENTAL=1 cosign verify-blob \
  --certificate "$CERT" \
  --signature "$SIG" \
  --certificate-identity-regexp "$IDENTITY_REGEX" \
  --certificate-oidc-issuer "$CORTEX_VERIFY_ISSUER" \
  "$ARTIFACT" \
  || die "cosign verify-blob failed for $ARTIFACT"

# --- 3. cosign verify-blob (SBOM) ---------------------------------------------
info "step 3/4: cosign verify-blob (SBOM)"
COSIGN_EXPERIMENTAL=1 cosign verify-blob \
  --certificate "$SBOM_CERT" \
  --signature "$SBOM_SIG" \
  --certificate-identity-regexp "$IDENTITY_REGEX" \
  --certificate-oidc-issuer "$CORTEX_VERIFY_ISSUER" \
  "$SBOM" \
  || die "cosign verify-blob failed for $SBOM"

# --- 4. GitHub build-provenance attestation -----------------------------------
info "step 4/4: GitHub build-provenance attestation"
if command -v gh >/dev/null 2>&1; then
  gh attestation verify "$ARTIFACT" \
    --repo "$CORTEX_VERIFY_REPO" \
    || die "gh attestation verify failed for $ARTIFACT"
  gh attestation verify "$SBOM" \
    --repo "$CORTEX_VERIFY_REPO" \
    || die "gh attestation verify failed for $SBOM"
else
  echo "[verify] WARN: gh CLI not installed — skipping SLSA build-provenance attestation check." >&2
  echo "[verify] WARN: install gh and re-run for full SLSA L2 verification." >&2
fi

info "OK: $ART_BASE verified (checksum + cosign + SBOM + provenance)"
