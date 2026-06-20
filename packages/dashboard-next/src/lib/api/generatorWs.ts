/**
 * Generator WS client (P3.4).
 *
 * Mirrors the dashboard's Terminal WS helper (`src/features/Terminal.tsx`
 * `terminalWsUrl`) but for the agent-generator sidecar. The sidecar multiplexes
 * three concerns on one socket:
 *   - AI chat deltas + advisor/skeptic panels
 *   - Live root PTY (so the operator can run `hermes-<slug> whatsapp setup` etc.)
 *   - Build / status / lifecycle events
 *
 * The sidecar authenticates the WS upgrade itself (Origin + session cookie +
 * admin re-derived live). The browser sends the session cookie automatically on
 * same-origin WS, so the client only needs the URL.
 *
 * Reconnects with exponential backoff (cap 10s) on close, unless close() was
 * called explicitly. Sends are coalesced at one frame per 200ms.
 *
 * Degraded mode: if the WS fails to establish (Caddy not deployed, sidecar
 * down, etc.), the page falls back to the P2 RPC path so the generator still
 * works request/response.
 */

// ─── Inbound frames (server → client) ────────────────────────────────────

export type GeneratorState = "connecting" | "live" | "closed" | "unavailable";

export interface ChatFrame {
  type: "chat";
  role: "assistant";
  delta: string;
}

export interface AdvisorFrame {
  type: "advisor";
  model: string;
  delta: string;
}

export interface SkepticFrame {
  type: "skeptic";
  model: string;
  delta: string;
}

export interface PtyFrame {
  type: "pty";
  data: string;
}

export interface StatusFrame {
  type: "status";
  status: string;
  detail?: string;
}

export interface ExitFrame {
  type: "exit";
  code: number;
}

export type GeneratorFrame =
  | ChatFrame
  | AdvisorFrame
  | SkepticFrame
  | PtyFrame
  | StatusFrame
  | ExitFrame;

// ─── Outbound frames (client → server) ──────────────────────────────────

export interface GeneratorAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

interface UserSend {
  type: "user";
  text: string;
  model?: string;
  attachments?: GeneratorAttachment[];
}

/** Outbound PTY keystrokes — matches the sidecar's `input` case (server.js). */
interface PtyInputSend {
  type: "input";
  data: string;
}

interface ResizeSend {
  type: "resize";
  cols: number;
  rows: number;
}

interface BuildSend {
  type: "build";
}

type OutboundFrame = UserSend | PtyInputSend | ResizeSend | BuildSend;

// ─── Session handle ──────────────────────────────────────────────────────

export interface GeneratorSessionOptions {
  /** Override the WS URL (used in tests; default = same-origin /agent-generator/ws). */
  url?: string;
  /** Frame handler. Returns an unsubscribe function (reserved for future filter API). */
  onFrame: (frame: GeneratorFrame) => void;
  /** Called when the state changes. */
  onState?: (state: GeneratorState) => void;
}
export interface GeneratorSession {
  /** Send a user turn. Optional attachments are forwarded to the sidecar
      which converts images to multimodal parts and renders a text manifest
      for the advisor/skeptic panels. Cap enforcement lives server-side. */
  send: (text: string, opts?: { model?: string; attachments?: GeneratorAttachment[] }) => void;
  /** Send raw bytes to the PTY (mirrors typing into the terminal pane). */
  sendPty: (data: string) => void;
  /** Send a resize message to the PTY (cols/rows). */
  resizePty: (cols: number, rows: number) => void;
  /** Trigger the build path on the sidecar (currently a no-op stub; the dashboard RPC builds). */
  build: () => void;
  /** Current connection state. */
  readonly state: GeneratorState;
  /** Stop reconnecting. Idempotent. */
  close: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────

const SEND_THROTTLE_MS = 200;
const MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 500;

/** Same-origin WS URL for the generator sidecar, proxied by Caddy. */
export function generatorWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/agent-generator/ws`;
}

/** Open a generator WS session. */
export function openGeneratorWs(opts: GeneratorSessionOptions): GeneratorSession {
  let ws: WebSocket | null = null;
  let attempt = 0;
  let closed = false;
  let pendingText: { text: string; model?: string; attachments?: GeneratorAttachment[] } | null = null;
  let flushTimer: number | undefined;
  let state: GeneratorState = "connecting";

  const setState = (next: GeneratorState) => {
    state = next;
    opts.onState?.(next);
  };

  const flushPending = () => {
    flushTimer = undefined;
    const openWs = ws;
    if (!pendingText || !openWs || openWs.readyState !== WebSocket.OPEN) return;
    const frame: UserSend = {
      type: "user",
      text: pendingText.text,
      ...(pendingText.model ? { model: pendingText.model } : {}),
      ...(pendingText.attachments && pendingText.attachments.length > 0
        ? { attachments: pendingText.attachments }
        : {}),
    };
    openWs.send(JSON.stringify(frame));
    pendingText = null;
  };

  const scheduleFlush = () => {
    if (flushTimer || !pendingText) return;
    flushTimer = window.setTimeout(flushPending, SEND_THROTTLE_MS);
  };
  const sendFrame = (frame: OutboundFrame) => {
    const openWs = ws;
    if (state !== "live" || !openWs || openWs.readyState !== WebSocket.OPEN) return;
    openWs.send(JSON.stringify(frame));
  };

  const connect = () => {
    if (closed) return;
    setState("connecting");
    try {
      ws = new WebSocket(opts.url ?? generatorWsUrl());
    } catch {
      setState("unavailable");
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      setState("live");
      if (pendingText) scheduleFlush();
    };
    ws.onmessage = (ev: MessageEvent) => {
      let frame: GeneratorFrame;
      try {
        frame = JSON.parse(typeof ev.data === "string" ? ev.data : "{}") as GeneratorFrame;
      } catch {
        return;
      }
      opts.onFrame(frame);
    };
    ws.onclose = (ev: CloseEvent) => {
      if (closed) return;
      setState("closed");
      // 4401/4403 = auth failures; do NOT retry — degrade to RPC.
      if (ev.code === 4401 || ev.code === 4403) {
        setState("unavailable");
        return;
      }
      const delay = Math.min(
        MAX_BACKOFF_MS,
        BASE_BACKOFF_MS * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4),
      );
      attempt += 1;
      window.setTimeout(connect, delay);
    };
    ws.onerror = () => {
      // Errors are followed by a close event; the close handler drives reconnect.
    };
  };

  connect();

  return {
    send(text, sendOpts) {
      pendingText = {
        text,
        model: sendOpts?.model,
        attachments: sendOpts?.attachments,
      };
      const openWs = ws;
      if (state === "live" && openWs && openWs.readyState === WebSocket.OPEN) {
        scheduleFlush();
      }
    },
    sendPty(data) {
      sendFrame({ type: "input", data });
    },
    resizePty(cols, rows) {
      sendFrame({ type: "resize", cols, rows });
    },
    build() {
      sendFrame({ type: "build" });
    },
    get state() {
      return state;
    },
    close() {
      closed = true;
      clearTimeout(flushTimer);
      try {
        ws?.close();
      } catch {}
    },
  };
}
