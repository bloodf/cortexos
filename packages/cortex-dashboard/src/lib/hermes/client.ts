import { z } from "zod";

const healthSchema = z.object({
  status: z.string(),
  version: z.string().optional(),
});

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([]),
});

export type HermesHealth = z.infer<typeof healthSchema>;
export type HermesModels = z.infer<typeof modelListSchema>;

function baseUrl(profile: string): string {
  const key = `HERMES_${profile.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
  return (process.env[key] || process.env.HERMES_BASE_URL || "http://127.0.0.1:18691").replace(/\/$/, "");
}

function authHeaders(profile: string): Record<string, string> {
  const key = `HERMES_${profile.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
  const token = process.env[key] || process.env.HERMES_API_KEY;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(profile: string, path: string): Promise<unknown> {
  const res = await fetch(`${baseUrl(profile)}${path}`, {
    headers: { accept: "application/json", ...authHeaders(profile) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hermes ${profile} ${path} returned HTTP ${res.status}`);
  return res.json();
}

export const hermes = {
  async health(profile = "primary"): Promise<HermesHealth> {
    return healthSchema.parse(await request(profile, "/health"));
  },

  async models(profile = "primary"): Promise<HermesModels> {
    return modelListSchema.parse(await request(profile, "/v1/models"));
  },
};

export type HermesClient = typeof hermes;
