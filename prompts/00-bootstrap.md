# 00 Bootstrap

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

Purpose: materialize this repository on a target machine at `/opt/cortexos`,
push runtime secrets safely, and then run the tool prompts in order.

Read first:

- `docs/AI-REPLICATION.md`
- `SETUP.md`
- `prompts/tools/_order.md`

## Operator Context

Run this from the operator machine, not from the target VPS. The operator
machine holds the Git checkout and the SOPS age private key. Plaintext secrets
are decrypted locally, copied to `/opt/cortexos/.secrets`, then removed from
the operator temp directory.

## Input Gate

**STOP — input question:** Please provide:

- `target_host`: SSH host or IP for the target machine.
- `sudo_user`: Linux user with sudo access on the target.
- `cortex_root`: target install root. Use `/opt/cortexos` unless you have a
  hard requirement to change it.
- `cortex_domain`: public or tailnet domain for the target.

Do not continue until the operator answers. After the answer, generate the
bootstrap command block with those values assigned in the same shell block. Do
not require the operator to predefine environment variables.

## Steps

After the operator answers the input gate, generate and run a block shaped like
this, substituting the provided values:

```bash
CORTEX_HOST='<target_host_from_chat>'
CORTEX_USER='<sudo_user_from_chat>'
CORTEX_ROOT='<cortex_root_from_chat>'
CORTEX_DOMAIN='<cortex_domain_from_chat>'
export CORTEX_HOST CORTEX_USER CORTEX_ROOT CORTEX_DOMAIN

source scripts/bootstrap.sh
bootstrap_check_local_deps
bootstrap_ensure_operator_age_key
bootstrap_detect_remote_os
bootstrap_push_repo
bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash scripts/preflight-tools.sh'
bootstrap_push_secrets
```

`CORTEX_ROOT` must be `/opt/cortexos`.

After secrets are present on the target, run the prompts from
`prompts/tools/_order.md` in order. Execute target commands through:

```bash
CORTEX_HOST='<target_host_from_chat>'
CORTEX_USER='<sudo_user_from_chat>'
CORTEX_ROOT='<cortex_root_from_chat>'
export CORTEX_HOST CORTEX_USER CORTEX_ROOT
source scripts/bootstrap.sh
bootstrap_run_remote 'cd "$CORTEX_ROOT" && <command>'
```

## Checkpoints

- SSH key auth works: `ssh "$CORTEX_USER@$CORTEX_HOST" true`
- Target repo exists: `/opt/cortexos/scripts/pkg.sh`
- Target preflight exits 0.
- Every `/opt/cortexos/.secrets/*.env` file is owned by `CORTEX_USER` and mode
  `600`.

## Rules

- Do not paste secrets into prompts or shell history.
- Do not commit generated runtime files, profile homes, logs, caches, or
  Paperclip/Honcho data.
- Do not install retired workflow services.
- Keep model calls behind 9Router.
