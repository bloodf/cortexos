# 12a — SOPS + age bootstrap (operator-laptop model)

**Goal**: hold the operator age private key on the laptop only, register
its public recipient in `.sops.yaml`, decrypt secrets locally during
bootstrap, and ship plaintext `.env` files to the VPS at
`/opt/cortexos/.secrets/`. **No private age key ever lives on the VPS.**

**Run order**: invoked as Step 1 of `prompts/00-bootstrap.md`. The laptop
must complete this prompt before `bootstrap_push_secrets` runs.

---

## 1. Install sops + age on your laptop

macOS:

```bash
brew install sops age
sops --version
age --version
```

Linux laptop (Ubuntu/Debian):

```bash
sudo apt-get update
sudo apt-get install -y sops age
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

The VPS does **not** appear in this list. The host never decrypts; the
laptop decrypts and ships plaintext to the host.

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

## 7. CHECKPOINT

```bash
ssh "$CORTEX_USER@$CORTEX_HOST" 'stat -c "%a %U %n" /opt/cortexos/.secrets/*.env'
```

Every line must read `600 <CORTEX_USER> /opt/cortexos/.secrets/<name>.env`.
Expected files: `paperclip.env`, `dashboard.env`, `consumer.env`,
`graph.env`, `langfuse.env`, `nats.env`.

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

## Rollback

To remove plaintext from the VPS without affecting Git history:

```bash
ssh "$CORTEX_USER@$CORTEX_HOST" 'sudo rm -rf /opt/cortexos/.secrets'
```

Re-run `bootstrap_push_secrets` to repopulate. Secrets in Git are
unchanged.
