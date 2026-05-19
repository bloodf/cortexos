# CortexOS Security Hardening Checklist

> Lives alongside `prompts/tools/10-os-hardening.md` and
> `prompts/tools/18-fail2ban.md`. This file is the operator-facing
> summary of every defensive control the spokes apply. Treat any
> deviation as an incident.

## Network posture

- **No public ingress.** UFW default-denies all inbound. The VPS is
  reachable only via Tailscale (`tailscale0` / `100.64.0.0/10`) and
  RFC1918 LAN ranges (`10.0.0.0/8`, `172.16.0.0/12`,
  `192.168.0.0/16`).
- **No public HTTP/HTTPS.** Caddy listens on `127.0.0.1:8080` and is
  served on `:443` by Tailscale serve. Public `:80` and `:443` are
  explicitly UFW-denied on the WAN interface.
- **SSH restricted.** `sshd` accepts inbound only from Tailscale + LAN
  (no `Anywhere` rule on `{SSH_PORT}/tcp`). UFW `limit in on tailscale0`
  applies rate-limiting.
- **Egress allowed.** UFW default-allows outbound — agents and
  package managers need it.

## SSH

- `PermitRootLogin no`, `PasswordAuthentication no`,
  `PermitEmptyPasswords no`, `ChallengeResponseAuthentication no`,
  `KbdInteractiveAuthentication no`.
- `AllowUsers cortexos` (only the operator account).
- `MaxAuthTries 3`, `MaxSessions 4`, `LoginGraceTime 20`,
  `ClientAliveInterval 300`, `ClientAliveCountMax 2`.
- No agent / TCP / X11 forwarding, no gateway ports, no tunnels.
- Modern crypto only: ed25519 / sntrup761x25519, ChaCha20-Poly1305 /
  AES-GCM, ETM MACs, SHA-2 host/pubkey algorithms.

## Kernel + sysctl

- Reverse-path filtering on, SYN cookies on, RFC1337 on.
- Source routing, ICMP redirects, secure redirects all disabled (v4 + v6).
- Martian logging on.
- `ip_forward = 0`, `ipv6.conf.all.forwarding = 0` (host, not router).
- `dmesg_restrict`, `kptr_restrict = 2`, `yama.ptrace_scope = 2`,
  `randomize_va_space = 2`, `unprivileged_userns_clone = 0`,
  `perf_event_paranoid = 3`.
- `suid_dumpable = 0`, protected hardlinks / symlinks / fifos / regular
  files all enforced.

## fail2ban

- Default `bantime 1h`, `findtime 10m`, `maxretry 5`, `banaction = ufw`,
  `backend = systemd`.
- `ignoreip` covers loopback + Tailscale CGNAT + all RFC1918 LANs (we
  never ban ourselves).
- Jails enabled:
  - **sshd** — `maxretry 3`, `bantime 2h`.
  - **recidive** — anyone banned in 3 jails within 1 day → 1-week ban.
  - **caddy-auth** — 401/403 abuse via Caddy `_SYSTEMD_UNIT=caddy.service`.

## System services

- `unattended-upgrades` enabled with daily security patches and
  `Unattended-Upgrade::Automatic-Reboot "false";` (manual reboots).
- `apparmor` enabled + active (default Debian/Ubuntu policy).
- `auditd` enabled + active. Default rules cover identity, time,
  privileged commands.
- `needrestart` configured to flag services that need a restart after
  package upgrades.
- `libpam-tmpdir` ensures per-user `/tmp` namespaces.

## Secrets

- All secrets live encrypted in `templates/.secrets/*.enc.yaml` (SOPS +
  age). Plaintext copies live only on the VPS under
  `/opt/cortexos/.secrets/*.env` (mode `0600`, owner `cortexos`).
- The operator age **private** key never leaves the laptop
  (`~/.config/sops/age/keys.txt`). The VPS only ever sees the
  decrypted runtime files.
- Recovery: `scripts/secrets-decrypt.sh` rebuilds `*.env` from the
  encrypted source. Never edit `.env` files by hand.

## Audit trail

- `audit_log` table is hash-chained (`@cortexos/audit`) — every paperclip
  transition, bridge inbound/outbound, graph node lifecycle, sandbox
  tool call, and approval decision appends a row whose
  `chain_hash = SHA-256(prev_hash || payload_hash)`.
- Chain heads are anchored hourly into Sigstore Rekor (`scripts/audit-anchor-cron.sh`).
- A tampered row breaks the chain on the next `verifyChain` pass.

## Sandbox

- Any untrusted tool execution runs under `stacks/cortex-sandbox-runner`
  (gVisor / `runsc`): no host network, ephemeral rootfs, per-call CPU /
  memory / wall-clock caps.

## Supply chain

- Container images and release artifacts are built in GitHub Actions
  with OIDC, signed keylessly with cosign, and shipped with syft SBOMs
  and SLSA L2 provenance.
- Operators verify on the VPS via `scripts/verify-artifact.sh`.

## What the operator must do

1. Run `prompts/tools/00-preflight.md` → `10-os-hardening.md` → `18-fail2ban.md` before any other spoke.
2. After bootstrap, immediately rotate every default credential listed
   in `docs/SERVICES.md` (Cortex Dashboard, Grafana, …).
3. Keep the age private key offline — do not check it into Git, do not
   sync it to the VPS, do not put it in 1Password without an air gap.
4. Re-run `ufw status verbose` after every install spoke and confirm no
   spoke ever opened `0.0.0.0/0`.
5. Audit `sudo fail2ban-client status` weekly. Investigate every
   `recidive` ban.
