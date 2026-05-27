# Fluent Bit (native)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Run Fluent Bit as a native systemd service to collect systemd journal logs and forward them to Loki.

## Prerequisites

- `21-loki.md` completed (Loki reachable at `127.0.0.1:3100`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
# OS family is detected by scripts/pkg.sh; if detection is unsupported, stop and ask the operator before continuing.
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — Loki `/ready` returns `ready`
- [ ] Install Fluent Bit package
- [ ] Install `templates/monitoring/fluent-bit.conf`
- [ ] Restart `fluent-bit`
- [ ] Query Loki `{job="fluent-bit"}` and confirm result count > 0
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `curl -s http://127.0.0.1:3100/ready` print `ready`?

Type `confirmed` to proceed.

## Install

```bash
curl -fsSL https://packages.fluentbit.io/fluentbit.key | sudo gpg --dearmor -o /usr/share/keyrings/fluentbit-keyring.gpg
. /etc/os-release
echo "deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/${ID}/${VERSION_CODENAME} ${VERSION_CODENAME} main" \
  | sudo tee /etc/apt/sources.list.d/fluent-bit.list
sudo apt-get update
pkg_install fluent-bit
sudo install -d -m 0755 /etc/fluent-bit
sudo install -m 0644 templates/monitoring/fluent-bit.conf /etc/fluent-bit/fluent-bit.conf
sudo systemctl enable --now fluent-bit
sudo systemctl restart fluent-bit
```

## Verify

```bash
sudo journalctl -u fluent-bit --no-pager -n 50
sleep 15
curl -fsS --get \
  --data-urlencode 'query={job="fluent-bit"}' \
  "http://127.0.0.1:3100/loki/api/v1/query" \
  | jq '.data.result | length'
```

Expected: a number `> 0`. If it prints `0`, wait 30 seconds and retry once before treating it as failure.

## CHECKPOINT 2

**STOP — operator question:** Did the Loki LogQL `{job="fluent-bit"}` query print an integer **> 0**?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/24-cadvisor.md`
