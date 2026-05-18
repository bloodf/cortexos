# @cortexos/paperclip-adapter

TypeScript adapter library for integrating CortexOS agents with [Paperclip](https://paperclip.dev). Provides:

- **`HttpAdapter`** — builds Paperclip HTTP webhook registration payloads.
- **`ExternalAdapter`** — stateless implementation of Paperclip's external-adapter primitives (`poll`, `checkout`, `complete`).
- **`parseTranscript`** — converts OMC artifact JSON into Paperclip rich-comment blocks.

## Install

```bash
npm install @cortexos/paperclip-adapter
```

Requires Node.js ≥ 22.

## Usage

```ts
import { HttpAdapter, ExternalAdapter, parseTranscript } from "@cortexos/paperclip-adapter";

const cfg = new HttpAdapter().register(
  "planner",
  "https://bridge.example.com/paperclip/webhook",
  process.env.PAPERCLIP_WEBHOOK_SECRET!,
);

const adapter = new ExternalAdapter({
  baseUrl: process.env.PAPERCLIP_BASE_URL!,
  token: process.env.PAPERCLIP_TOKEN!,
});

const inbox = await adapter.poll();
const claim = await adapter.checkout("issue-123", "run-456");
const done  = await adapter.complete("issue-123", "run-456", { result: "ok" });

const blocks = parseTranscript({
  taskId: "T-100",
  runId: "R-1",
  steps: [{ role: "executor", action: "edit", content: "diff…", timestamp: new Date().toISOString() }],
  result: "All steps complete.",
});
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Compile TypeScript to `dist/` (ESM + `.d.ts`). |
| `npm test` | Run vitest unit tests. |
| `npm run test:coverage` | Run tests with coverage (≥ 80% required). |

## License

MIT
