// Stub for drift simulation — used by SimulateMenu for demo scenarios.
import type { NetworkInterface } from "@/lib/types";

interface SystemSnapshot {
  cpu: number;
  memory: { percent: number; used: number; total: number };
  drives: unknown[];
  mounts: unknown[];
  load: number[];
  uptime: number;
}

interface NetworkSnapshot {
  interfaces: NetworkInterface[];
}

export interface LiveDrift {
  simulate: () => Promise<unknown>;
  crashRandom?: () => { name: string } | null;
  healAll?: () => void;
  system?: () => SystemSnapshot;
  network?: () => NetworkSnapshot;
}

export const live: LiveDrift = {
  simulate: async () => ({}),
};
