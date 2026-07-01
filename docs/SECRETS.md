# Secrets Management

> **How CortexOS keeps your passwords and API keys safe.**

---

## Why Encrypt Secrets?

Your server needs passwords, API keys, and tokens to work. Storing these in plain text is dangerous — anyone who can read the file can steal your credentials.

CortexOS uses **SOPS + age** to encrypt secrets:

- **age** — a modern encryption tool (like a better version of PGP)
- **SOPS** — adds structured encryption so you can edit encrypted files easily

**The rule:** Never commit plaintext secrets to Git. Only encrypted `.enc.yaml` files go in the repo.

---

## Quick Start

### 1. Install age and SOPS

```bash
# age (encryption)
apt install age

# SOPS (structured encryption editor)
wget -O sops https://github.com/getsops/sops/releases/download/v3.9.0/sops-v3.9.0.linux.amd64
chmod +x sops
mv sops /usr/local/bin/
```

### 2. Create Your Encryption Key

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

This creates two keys:
- **Public key** — safe to share, used for encrypting
- **Private key** — keep secret, used for decrypting

### 3. Tell SOPS Your Public Key

Edit `.sops.yaml` in the repo root:

```yaml
creation_rules:
  - path_regex: \.enc\.yaml$
    age: >-
      age1yourpublickeyhere...
```

Replace `age1yourpublickeyhere...` with your actual public key from `keys.txt`.

### 4. Encrypt a Secret

```bash
# Create a secret file
echo "DB_PASSWORD=my-secret-password" > dashboard.env

# Encrypt it
sops -e dashboard.env > dashboard.env.enc.yaml

# Delete the plaintext file
rm dashboard.env
```

Now `dashboard.env.enc.yaml` is safe to commit.

### 5. Decrypt on Your Server

```bash
sops -d dashboard.env.enc.yaml > /opt/cortexos/.secrets/dashboard.env
chmod 600 /opt/cortexos/.secrets/dashboard.env
```

The decrypted file lives only on your server, never in Git.

---

## Where Secrets Live

```
Repository (Git)
├── secrets/
│   ├── dashboard.env.enc.yaml      ← Encrypted, safe to commit
│   └── caddy.env.enc.yaml          ← Encrypted, safe to commit
│
Server (never in Git)
└── /opt/cortexos/.secrets/
    ├── dashboard.env               ← Decrypted at runtime
    └── caddy.env                   ← Decrypted at runtime
```

---

## Common Secret Files

| File | What's Inside |
|------|--------------|
| `dashboard.env` | Database password, session secret |
| `caddy.env` | TLS certificate email |

---

## Rotating a Secret

If a secret is compromised:

1. Change the password/API key at the provider
2. Update the plaintext value
3. Re-encrypt: `sops -e new-secret.env > new-secret.env.enc.yaml`
4. Commit the new `.enc.yaml`
5. Redeploy to your server
6. Restart affected services

---

## Learn More

- **SOPS documentation:** https://github.com/getsops/sops
- **age encryption:** https://age-encryption.org
- **Tool catalog:** [`TOOLS.md`](TOOLS.md)
