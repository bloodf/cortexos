# Secrets Management

CortexOS uses **SOPS + age** to keep secrets encrypted at rest in Git. The host decrypts on bring-up to `/opt/cortexos/.secrets/*.env`.

## Model

- **Source of truth**: `templates/.secrets/*.enc.yaml` (committed encrypted).
- **Authoring**: maintainers with an authorized age private key edit via `sops <file>`.
- **Runtime**: host age key in `/opt/cortexos/.age/host.key` (chmod 600) decrypts at provision time.
- **Output**: `/opt/cortexos/.secrets/<service>.env` (chmod 600, owner `cortex`, gitignored).

## Layout

| Path | Form | Committed |
|------|------|-----------|
| `.sops.yaml` | recipient config | yes |
| `templates/.secrets/*.enc.yaml` | SOPS-encrypted YAML | yes |
| `templates/.secrets/*.env.example` | plaintext docs/templates | yes |
| `/opt/cortexos/.age/host.key` | age private key | no (host only) |
| `/opt/cortexos/.secrets/*.env` | decrypted runtime env | no |

## Files (current)

- `paperclip.enc.yaml` — cortex-paperclip-bridge
- `dashboard.enc.yaml` — cortex-dashboard (Next.js)
- `consumer.enc.yaml` — cortex-consumer (NATS daemon)
- `graph.enc.yaml` — cortex-graph (V7)
- `langfuse.enc.yaml` — observability (V8)
- `nats.enc.yaml` — NATS broker accounts

## Bootstrap

See `prompts/tools/12a-sops-bootstrap.md`. Summary:

1. `pkg_install sops age`
2. `age-keygen -o /opt/cortexos/.age/host.key`
3. Add host pubkey to `.sops.yaml`
4. `sops updatekeys templates/.secrets/*.enc.yaml`
5. `bash scripts/secrets-decrypt.sh`

## Rotation

```bash
# Auto-generate a new value:
bash scripts/secrets-rotate.sh CORTEX_NATS_HMAC

# Provide an explicit value:
bash scripts/secrets-rotate.sh PAPERCLIP_WEBHOOK_SECRET "$(openssl rand -hex 32)"
```

The script rewrites every `templates/.secrets/*.enc.yaml` that contains `KEY`, re-encrypting in place. Commit, push, redeploy.

**Cadence** (default):

| Secret | Cadence |
|--------|---------|
| `CORTEX_NATS_HMAC` | quarterly |
| `PAPERCLIP_WEBHOOK_SECRET` | quarterly + on suspected leak |
| `PAPERCLIP_API_KEY` | as Paperclip dictates |
| `CORTEX_MASTER_KEY` (dashboard) | annually + on suspected leak |
| Database passwords | annually |
| age host key | on host rebuild or key compromise |

## Recovery

Encryption uses **multiple** age recipients. Loss of one private key still allows decryption with any other listed recipient. Always keep at least one offline custodian key.

- **Host key lost** (e.g. disk failure): regenerate host key, run `sops updatekeys` from any authorized workstation, redeploy.
- **All private keys lost**: secrets are unrecoverable — rotate every secret in every external system (Paperclip, OpenAI, etc.) and bootstrap from scratch.

## CI

`.github/workflows/secrets-scan.yml` enforces:

1. `gitleaks` over the full tree (rejects high-entropy strings outside `templates/.secrets/*.enc.yaml`).
2. No plaintext `*.env` may be added under `templates/.secrets/` (only `*.env.example` and `*.enc.yaml`).
3. `*.enc.yaml` files without a `sops:` metadata block are rejected (means: committed in plaintext by accident).

## Threats and responses

| Threat | Response |
|--------|----------|
| Host age key stolen | rotate every secret, regenerate host key, `sops updatekeys`, redeploy. |
| Committer machine compromised | revoke their age recipient from `.sops.yaml`, `sops updatekeys`, rotate webhook + HMAC secrets. |
| Recovery custodian key compromised | same as above; remove from recipients, `sops updatekeys`. |
| Plaintext secret leaked to Git | rotate the affected secret immediately; `git filter-repo` history scrub is best-effort, treat as public. |

## Anti-patterns (do NOT do)

- Commit plaintext `.env` under `templates/.secrets/`.
- Store the host age private key in Git or any chat / ticket system.
- Use a single age recipient — always include a recovery custodian.
- Hand-edit `/opt/cortexos/.secrets/*.env` on the host — always rotate via `secrets-rotate.sh` and redecrypt.
