# Troubleshooting

## Hermes

- Check profile health on `127.0.0.1:18691` for Primary and
  `127.0.0.1:18692` for Secondary.
- Confirm the profile env file exists under `/opt/cortexos/.secrets/hermes/`.
- Confirm 9Router exposes the configured model.

## Honcho

- Check `curl -fsS http://127.0.0.1:18690/health`.
- Confirm data lives under `/opt/cortexos/data/honcho`.
- Confirm no profile is sharing the wrong workspace.

## Paperclip

- Paperclip should call Hermes through `hermes-paperclip-adapter`.
- If a minimal HTTP shim is used, it must not publish to a workflow bus or own workflow
  state.
