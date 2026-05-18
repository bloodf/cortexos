# 12a — SOPS + age bootstrap

**Goal**: install sops + age on the VPS, generate a host age key, register it in `.sops.yaml`, re-encrypt every `templates/.secrets/*.enc.yaml` for the new recipient set, and decrypt to `/opt/cortexos/.secrets/*.env`.

**Run order**: after `prompts/os/00-os-selection.md`, before any service prompt that reads `/opt/cortexos/.secrets/*.env`.

---

## 1. Install sops + age

Use the distro dispatcher. Both packages are in Ubuntu 24.04 and Debian 13 main repos.

```bash
source scripts/pkg.sh
pkg_install sops age
sops --version
age --version
```

## 2. Generate the host age key (one-time)

```bash
sudo install -d -m 0700 -o "${CORTEX_USER:-cortex}" -g "${CORTEX_USER:-cortex}" /opt/cortexos/.age
sudo -u "${CORTEX_USER:-cortex}" age-keygen -o /opt/cortexos/.age/host.key
sudo chmod 0600 /opt/cortexos/.age/host.key
HOST_PUB="$(sudo age-keygen -y /opt/cortexos/.age/host.key)"
echo "Host age public key: ${HOST_PUB}"
```

Store the **private** key offline (password manager / sealed envelope) as well. Loss of every private key = unrecoverable secrets.

## 3. Register the host pubkey in `.sops.yaml`

Edit `.sops.yaml` at repo root. Replace the placeholder line(s) with the real recipients:

```yaml
creation_rules:
  - path_regex: templates/\.secrets/.*\.enc\.yaml$
    age:
      - <ops-lead-pub>          # workstation, used to author edits
      - <recovery-custodian-pub># offline backup
      - <host-pub>              # output of step 2 — production decrypt
```

Commit `.sops.yaml`.

## 4. Re-encrypt every secrets file for the new recipient set

From a workstation that holds an authorized private key:

```bash
sops updatekeys templates/.secrets/paperclip.enc.yaml
sops updatekeys templates/.secrets/dashboard.enc.yaml
sops updatekeys templates/.secrets/consumer.enc.yaml
sops updatekeys templates/.secrets/graph.enc.yaml
sops updatekeys templates/.secrets/langfuse.enc.yaml
sops updatekeys templates/.secrets/nats.enc.yaml
```

Commit the updated `.enc.yaml` files.

## 5. Populate real values

On a trusted workstation (never on the host), edit each file and replace `<replace-me>` with real secrets:

```bash
sops templates/.secrets/paperclip.enc.yaml
```

`sops` opens `$EDITOR`, decrypts in-memory, re-encrypts on save. Commit the result.

## 6. Decrypt on the host

```bash
sudo -E SOPS_AGE_KEY_FILE=/opt/cortexos/.age/host.key \
  bash scripts/secrets-decrypt.sh
```

## 7. Checkpoint

```bash
ls -la /opt/cortexos/.secrets/
# expect: paperclip.env, dashboard.env, consumer.env, graph.env, langfuse.env, nats.env
# all mode 600, owner cortex:cortex
stat -c '%a %U %n' /opt/cortexos/.secrets/*.env
```

All files must report `600 cortex /opt/cortexos/.secrets/<name>.env`.

---

## Rollback

```bash
sudo rm -rf /opt/cortexos/.secrets
sudo rm -rf /opt/cortexos/.age
```

Re-run from step 2. Secrets in Git are unchanged; only the host key is regenerated.
