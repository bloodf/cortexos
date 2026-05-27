# 12a — SOPS + age bootstrap (operator-laptop model)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

**Goal**: hold the canonical operator age private key on the laptop
(`~/.config/sops/age/keys.txt`), register its public recipient in
`.sops.yaml`, and use it to decrypt secrets during bootstrap. The laptop
ships plaintext `.env` files to the VPS at `/opt/cortexos/.secrets/` and
also pushes a copy of the age private key to the VPS at
`/opt/cortexos/.age/host.key` (mode `0600`, owner `$CORTEX_USER`) so
spoke prompts that invoke `scripts/secrets-decrypt.sh` on the host can
re-decrypt deterministically. **The age private key is never in Git.**
The canonical copy stays on the laptop; the VPS copy is treated as a
deployment artifact and may be rotated/wiped at any time.

**Run order**: invoked as Step 1 of `prompts/00-bootstrap.md`. The laptop
must complete this prompt before `bootstrap_push_secrets` runs.

---

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] `apt-get install -y sops age` on laptop (sops ≥ 3.8)
- [ ] Generate operator age key via `age-keygen -o ~/.config/sops/age/keys.txt` (mode 600)
- [ ] Add operator pubkey to `.sops.yaml` under `templates/.secrets/.*\.enc\.yaml$`
- [ ] Run `sops updatekeys` on every `templates/.secrets/*.enc.yaml` and commit
- [ ] Run `bootstrap_push_secrets` to scp plaintext `.env` + `host.key` to VPS
- [ ] CHECKPOINT 1 confirmed — every `.env` is 600 + `host.key` exists on VPS

## 1. Install sops + age on your laptop

Linux laptop (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install -y sops age
sops --version
age --version
```

`sops` ≥ 3.8 is required for first-class age recipient support.

## 2. Generate the operator age key (once per laptop)

```bash
mkdir -p ~/.config/sops/age
chmod 700 ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
OPERATOR_PUB="$(age-keygen -y ~/.config/sops/age/keys.txt)"
echo "Operator age public key: ${OPERATOR_PUB}"
```

`~/.config/sops/age/keys.txt` is the **only** copy of your operator
private key. Back it up to a password manager or sealed envelope. Loss of
every authorized private key = unrecoverable secrets.

The convenience function `bootstrap_ensure_operator_age_key` in
`scripts/bootstrap.sh` performs steps 1 and 2 idempotently.

## 3. Register the operator pubkey in `.sops.yaml`

Edit `.sops.yaml` at repo root. Under the rule for
`templates/.secrets/.*\.enc\.yaml$`, ensure the operator pubkey is listed:

```yaml
creation_rules:
  - path_regex: templates/\.secrets/.*\.enc\.yaml$
    age:
      - <operator-laptop-pub>      # this laptop — primary author + decrypt
      - <recovery-custodian-pub>   # offline backup, kept in sealed storage
```

Commit `.sops.yaml`. Multiple operators authoring on different laptops
each add their own pubkey.

The VPS does **not** appear in `.sops.yaml` as a distinct recipient —
the VPS reuses the operator age key pushed by `bootstrap_push_secrets`
to `/opt/cortexos/.age/host.key`. The Git side of the recipient set
stays operator-laptop + recovery-custodian only; the host key is a
runtime artifact, not a Git-tracked identity.

## 4. Re-encrypt every secrets file for the new recipient set

From the laptop, with the operator key authorized in `.sops.yaml`:

```bash
for f in templates/.secrets/*.enc.yaml; do
  sops updatekeys "$f"
done
git add .sops.yaml templates/.secrets/*.enc.yaml
git commit -m "chore(secrets): rotate sops recipients"
```

`sops updatekeys` rewrites the per-file MAC and recipient list without
changing plaintext.

## 5. Populate real values (workstation only, never on host)

```bash
sops templates/.secrets/paperclip.enc.yaml
```

`$EDITOR` opens with the plaintext; saving re-encrypts to disk. Commit
the updated `.enc.yaml`. Plaintext never lands on disk.

## 6. Decrypt during bootstrap and push to the VPS

This is automated by `scripts/bootstrap.sh`:

```bash
bootstrap_push_secrets
```

Internally it runs, on the laptop:

```bash
SOPS_AGE_KEY_FILE=~/.config/sops/age/keys.txt \
  SECRETS_DEST_DIR=<tmp-dir-on-laptop> \
  bash scripts/secrets-decrypt.sh

scp <tmp-dir>/*.env $CORTEX_USER@$CORTEX_HOST:/tmp/...
ssh $CORTEX_USER@$CORTEX_HOST \
  'sudo install -m 0600 -o $CORTEX_USER -g $CORTEX_USER ... /opt/cortexos/.secrets/'
```

The laptop temp dir is wiped on exit. Plaintext lives only in
`/opt/cortexos/.secrets/<name>.env` on the VPS, mode `0600`, owned by
`$CORTEX_USER`.

`bootstrap_push_secrets` additionally `scp`s
`~/.config/sops/age/keys.txt` to `/opt/cortexos/.age/host.key` on the
VPS (mode `0600`, owned by `$CORTEX_USER`) so downstream spokes that
re-run `scripts/secrets-decrypt.sh` on the host (e.g. rotation,
emergency re-decrypt) succeed without round-tripping through the
laptop. The host copy is never committed to Git and can be wiped/rotated
independently of the laptop key.

## CHECKPOINT 1

**STOP — operator question:** Does every line of `ssh "$CORTEX_USER@$CORTEX_HOST" 'stat -c "%a %U %n" /opt/cortexos/.secrets/*.env'` read `600 <CORTEX_USER> /opt/cortexos/.secrets/<name>.env` (not `644`, not `root` owner) — covering `paperclip.env`, `dashboard.env`, `honcho.env`, `langfuse.env`, `9router.env`, and Hermes profile env files?

Type `confirmed` to proceed.

## CHECKPOINT 2

**STOP — operator question:** Does `ssh "$CORTEX_USER@$CORTEX_HOST" 'stat -c "%a %U %n" /opt/cortexos/.age/host.key'` print `600 <CORTEX_USER> /opt/cortexos/.age/host.key` (not `No such file or directory`)?

Type `confirmed` to proceed.

---

## Recovery — lost operator laptop key

If the laptop with the only authorized private key is lost:

1. From any laptop with an authorized recovery custodian key, run
   `sops updatekeys` after removing the lost pubkey from `.sops.yaml`
   and adding the new operator pubkey.
2. Commit and push `.sops.yaml` and the updated `templates/.secrets/*.enc.yaml`.
3. Re-run `bootstrap_push_secrets` from the new laptop; the VPS gets
   fresh plaintext `.env` files signed under the new recipient set.

If **all** private keys are lost, the encrypted YAML is unrecoverable.
Rotate every credential from upstream providers and re-author the
secrets files from scratch.

## Plaintext Cleanup

To remove plaintext from the VPS without affecting Git history:

```bash
ssh "$CORTEX_USER@$CORTEX_HOST" 'sudo rm -rf /opt/cortexos/.secrets'
```

Re-run `bootstrap_push_secrets` to repopulate. Secrets in Git are
unchanged.

## Next

→ `prompts/tools/13-tailscale-serve.md`
