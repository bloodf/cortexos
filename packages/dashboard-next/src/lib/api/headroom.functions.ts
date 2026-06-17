/**
 * Headroom — server functions.
 *
 * Transport is createServerFn RPC (ADR-001). The gate fetches the local
 * Headroom proxy's /stats and /health endpoints and returns them to the
 * dashboard. All calls stay server-side so the client never talks to the
 * proxy directly.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { defineServerFn, serverFnNoop } from "@/lib/api/define-server-fn";

const HEADROOM_BASE_URL = "http://127.0.0.1:8787";

export interface HeadroomHealth {
  service: string;
  status: "healthy" | "unhealthy";
  ready: boolean;
  version: string;
  timestamp: string;
  uptime_seconds: number;
}

export interface HeadroomStats {
  summary?: {
    mode?: string;
    api_requests?: number;
    primary_model?: string;
    compression?: {
      requests_compressed?: number;
      avg_compression_pct?: number;
      total_tokens_removed?: number;
    };
    cost?: {
      without_headroom_usd?: number;
      with_headroom_usd?: number;
      total_saved_usd?: number;
      savings_pct?: number;
    };
    mcp?: {
      compressions?: number;
      tokens_removed?: number;
      retrievals?: number;
    };
  };
  savings?: {
    total_tokens?: number;
    per_project?: Record<
      string,
      {
        requests?: number;
        tokens_saved?: number;
        compression_savings_usd?: number;
        total_input_tokens?: number;
        total_input_cost_usd?: number;
        last_activity_at?: string;
        savings_percent?: number;
      }
    >;
  };
}

// ---------------------------------------------------------------------------
// getHeadroomUrl — GET, auth: any → { url: string }
// ---------------------------------------------------------------------------

const getHeadroomUrlGate = defineServerFn({
  method: "GET",
  auth: "any",
  input: z.object({}).strict(),
  surface: "headroom",
  action: "headroom.url",
  handler: async () => {
    const origin = process.env.DASHBOARD_ORIGIN || "http://127.0.0.1:8787";
    return { url: `${origin}:8787/dashboard` };
  },
});

export const getHeadroomUrl = createServerFn({ method: "GET" })
  .middleware([getHeadroomUrlGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// getHeadroomHealth — GET, auth: any → HeadroomHealth
// ---------------------------------------------------------------------------

const getHeadroomHealthGate = defineServerFn({
  method: "GET",
  auth: "any",
  input: z.object({}).strict(),
  surface: "headroom",
  action: "headroom.health",
  handler: async () => {
    const res = await fetch(`${HEADROOM_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Headroom health endpoint returned ${res.status}`);
    }
    const data = (await res.json()) as HeadroomHealth;
    return data;
  },
});

export const getHeadroomHealth = createServerFn({ method: "GET" })
  .middleware([getHeadroomHealthGate])
  .handler(serverFnNoop);

// ---------------------------------------------------------------------------
// getHeadroomStats — GET, auth: any → HeadroomStats
// ---------------------------------------------------------------------------

const getHeadroomStatsGate = defineServerFn({
  method: "GET",
  auth: "any",
  input: z.object({}).strict(),
  surface: "headroom",
  action: "headroom.stats",
  handler: async () => {
    const res = await fetch(`${HEADROOM_BASE_URL}/stats?cached=1`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Headroom stats endpoint returned ${res.status}`);
    }
    const data = (await res.json()) as HeadroomStats;
    return data;
  },
});

export const getHeadroomStats = createServerFn({ method: "GET" })
  .middleware([getHeadroomStatsGate])
  .handler(serverFnNoop);
