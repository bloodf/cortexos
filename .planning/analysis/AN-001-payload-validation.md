# AN-001 — GET server-fn 400 "Unrecognized key(s) in object: 'payload'"

> Document type: defect ANALYSIS. It locates the defect and recommends a fix
> direction. The implementation contract — file ownership, TDD task order,
> binary acceptance criteria, out-of-scope list — lives in micro-plan MP-002,
> which is gated separately before any code is touched.

## 1. Where GET input is extracted

`packages/dashboard-next/src/server/server-fn-pipeline.ts:358-363`

```typescript
async function readRequestInput(request: Request): Promise<unknown> {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'DELETE') {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of new URL(request.url).searchParams.entries()) obj[k] = v;
    return obj;
  }
  ...
}
```

For a GET request it dumps **every** query-string key into a plain object unchanged.

## 2. Where zod validation runs and how 'payload' reaches it

`packages/dashboard-next/src/server/server-fn-pipeline.ts:174-175`

```typescript
const raw = await readRequestInput(request);
const parsed = opts.input.safeParse(raw);
```

TanStack Start's client fetcher serializes a GET server-fn's input into a single query parameter named `payload` (shape `?payload=<urlencoded-serialized-object>`). Because `readRequestInput` does not deserialize that envelope, the value fed to the schema is:

```js
{ payload: "<serialized string>" }
```

All current GET schemas use `.strict()` (e.g. `packages/dashboard-next/src/lib/api/system.functions.ts:34` `const EmptyInput = z.object({}).strict();` and `services.functions.ts:30-39` `ServiceListInput ... .strict()`). A strict schema rejects the unknown `payload` key, producing exactly the observed error:

> Unrecognized key(s) in object: 'payload'

**Hypothesis: CONFIRMED.** The evidence chain is:
1. Client serializes GET input as `?payload=...` — proven empirically by
   the live captures: all 21 failing requests in
   `.planning/harness/artifacts/screen-defects-2.md` are
   `GET /_serverFn/<hash>?payload=%7B...%7D`. Reproduce:
   `grep -c 'payload=%7B' .planning/harness/artifacts/screen-defects-2.md` → 21.
2. `readRequestInput` returns the raw query-param object `{ payload: "..." }`.
3. `opts.input.safeParse(raw)` validates that raw object against a `.strict()` schema.
4. `.strict()` fails on the unexpected `payload` key.

## 3. Why /network, /approvals, /alerts, /agents appear to pass / render fine

* `/approvals`, `/alerts`, `/agents` — **never make a server-fn call**. In `packages/dashboard-next/src/lib/api/client.ts` they are explicitly stubbed with `notYetWired`:
  * `client.ts:664-669` — `api.alerts.rules`, `api.alerts.history`, `api.alerts.rulesList`, `api.alerts.historyList`
  * `client.ts:673` — `api.approvals`
  * `client.ts:694` — `api.agents`
  
  Each throws a client-side error before any HTTP request is emitted, so the 400 payload-validation response is never hit.

* `/network` — **the call actually carries empty input and, with the current bug, it too would receive a 400**. The client call is at `client.ts:502`:
  ```typescript
  network: (): Promise<NetworkData> => getNetworkFn({ data: {} }),
  ```
  The schema is `EmptyInput = z.object({}).strict()` (`system.functions.ts:34`). TanStack Start still serializes `{ data: {} }` into `?payload=...`, so `readRequestInput` returns `{ payload: "..." }` and validation fails.

  The page **appears** to render fine because `packages/dashboard-next/src/features/Network.tsx:13` invokes it via `useQuery` with no error handling:
  ```typescript
  const { data: net } = useQuery({ queryKey: ["network"], queryFn: api.network, refetchInterval: 3000 });
  ```
  When the query fails, `data` is `undefined`, `interfaces` falls back to `[]`, and the component renders an empty but non-crashing view. The 400 response is therefore silent, not absent.

## 4. Minimal fix

**Recommended option: B** — use the data TanStack Start already deserialized for the middleware, instead of re-parsing the raw request.

TanStack Start's server runtime extracts `payload`, deserializes it, and passes the result as `data` to the `.server()` middleware context. The gate currently discards it by destructuring only `{ next }`.

Framework evidence (installed version 1.169.14), from
`node_modules/.pnpm/@tanstack+start-server-core@1.169.14_crossws@0.4.6_srvx@0.11.16_/node_modules/@tanstack/start-server-core/dist/esm/server-functions-handler.js:49-56`:

```js
if (methodUpper === "GET") {
  const payloadParam = url.searchParams.get("payload");
  if (payloadParam && payloadParam.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large");
  const payload = payloadParam ? parsePayload(JSON.parse(payloadParam)) : {};
  payload.context = safeObjectMerge(payload.context, context);
  payload.method = methodUpper;
  return await action(payload);
}
```

The framework's own handler extracts and deserializes `payload` and invokes
the server-fn action with the resulting params object (which carries `data`);
the POST branch directly below does the same from the JSON body. Reproduce:
`grep -n 'searchParams.get("payload")' node_modules/.pnpm/@tanstack+start-server-core@1.169.14*/node_modules/@tanstack/start-server-core/dist/esm/server-functions-handler.js`.

The remaining link — that this params object reaches the `.server()`
middleware as `data` — is in
`node_modules/.pnpm/@tanstack+start-client-core@1.170.12/node_modules/@tanstack/start-client-core/dist/esm/createServerFn.js`:

```js
// :62-70 — action(payload) lands in __executeServer(opts); opts (incl. data)
// is spread into the middleware chain's ctx:
__executeServer: async (opts) => {
  ...
  return await executeMiddleware(resolvedMiddleware, "server", {
    ...extractedFn,
    ...opts,
    ...
// :121-124 — each middleware fn receives the full ctx (incl. data):
const result = await middlewareFn({
  ...ctx,
  next: userNext
});
```

So `.server(async ({ data, next }) => ...)` receives the deserialized input.
Reproduce: `grep -n '__executeServer\|middlewareFn({' node_modules/.pnpm/@tanstack+start-client-core@1.170.12/node_modules/@tanstack/start-client-core/dist/esm/createServerFn.js`.
The empirical backstop is MP-002's TDD step: the failing test drives the real
pipeline through the node-env harness (`src/lib/api/__tests__/`) and must
flip green only when the middleware-provided `data` reaches validation.

### Option A — deserialize `payload` in `readRequestInput` (not recommended)
In `server-fn-pipeline.ts:358-363`, detect that the only query param is `payload`, URL-decode and JSON/seroval-parse it, and return the inner `data` object. This couples the framework-agnostic pipeline to TanStack's serialization format; if the format changes, the gate breaks.

### Option B — accept `data` from the middleware and thread it through the pipeline (recommended)
Three-line change set (conceptual):

1. `packages/dashboard-next/src/lib/api/define-server-fn.ts:133` — capture `data` from the middleware context:
   ```typescript
   return createMiddleware({ type: 'function' }).server(async ({ data, next }) => {
   ```

2. `packages/dashboard-next/src/lib/api/server-fn-runner.server.ts:23` — pass `data` into `runServerFnGate` as `inputData`:
   ```typescript
   export async function runServerFnGate<TIn, TOut>(opts: RouteOptions<TIn, TOut> & { inputData?: TIn }): Promise<TOut> {
     const request = getRequest();
     const core = defineApiRoute<TIn, TOut>(opts);
     ...
   ```

3. `packages/dashboard-next/src/server/server-fn-pipeline.ts:172-188` — use `opts.inputData` when supplied, otherwise fall back to `readRequestInput`:
   ```typescript
   const raw = opts.inputData !== undefined ? opts.inputData : await readRequestInput(request);
   const parsed = opts.input.safeParse(raw);
   ```
   `!== undefined` rather than `??`: the pipeline accepts arbitrary schemas
   (`input?: ZodType<TIn, ZodTypeDef, unknown>`, server-fn-pipeline.ts:72),
   so a legitimately `null` input must reach validation instead of
   triggering the raw-request fallback.

**What it must NOT break:**
* **POST path** — TanStack Start deserializes POST bodies into the same middleware `data`, so the fix applies uniformly.
* **CSRF** — `requireCsrf` still inspects the original `request` object and headers; it is untouched by this change.
* **Typed envelope** — the pipeline still validates with the zod schema, still returns the same `400 { code: 'validation', details: [...] }` envelope on bad input, and still audits through the same path.
* **Direct tests** — unit tests that call `defineApiRoute` directly with raw `Request` objects continue to work because `inputData` is optional and `readRequestInput` remains the fallback.

## 5. /terminal WS 404 (ws://127.0.0.1:3080/terminal/ws bypassing Caddy)

**Test-environment artifact** — not a code defect in the existing implementation.

The frontend requests `/terminal/ws` (`packages/dashboard-next/src/features/Terminal.tsx:24-27`):
```typescript
function terminalWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/terminal/ws`;
}
```

The intended path is through Caddy, which proxies `/terminal/ws` to the
`cortex-terminal` sidecar on `:3081` (`packages/cortex-terminal`,
`cortex-terminal.service` — shipped in WP-19). The direct
`ws://127.0.0.1:3080/terminal/ws` request in the test environment bypasses
Caddy and hits the dashboard-next server, which intentionally has no
WebSocket handler for that path (ADR-001: the app itself exposes no WS
routes; the sidecar does). In-source comments at `pty-bridge.ts:480-506`
describing the PTY as "blocked" predate WP-19 and are NOT evidence here —
they are stale and should not be relied on either way.

The UI is explicitly built to degrade to a local mock when the live sidecar is unreachable (`Terminal.tsx:192-233` and `:275-299`). The 404 is therefore the expected behavior in an environment where the PTY sidecar is not running, and the code handles it correctly by falling back to the mock shell.

Verifiable evidence:
- `packages/dashboard-next/src/features/Terminal.tsx:22-34` — the WS URL is
  built from `window.location.host` ("`/terminal/ws` → 127.0.0.1:3081" per
  the comment at :22), `LiveState` includes `"mock"` (:29), and the mock
  banner text is "live PTY unavailable — sidecar not reachable" (:32).
  Reproduce: `grep -n 'terminal/ws\|mock' packages/dashboard-next/src/features/Terminal.tsx`.
- `docs/rebuild/caddy-terminal.snippet:12-14` — Caddy matches
  `path /terminal/ws` and `reverse_proxy 127.0.0.1:3081`; the verification
  run hit `ws://127.0.0.1:3080/...` directly, bypassing this route.
- Caveat: the cited in-source comments at `pty-bridge.ts:480-506` ("blocked,
  no WS mechanism") predate WP-19; the live path shipped as the separate
  `packages/cortex-terminal` sidecar + `cortex-terminal.service` (see
  docs/rebuild/HANDOFF.md "Terminal PTY"). This does not change the
  conclusion: through Caddy the route exists; bypassing Caddy yields the
  404 and the designed mock fallback.

ANALYSIS-COMPLETE
