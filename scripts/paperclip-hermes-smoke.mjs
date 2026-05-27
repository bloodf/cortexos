#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const registryPath = process.env.HERMES_PROFILES_REGISTRY || "/opt/cortexos/hermes/profiles.json";
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const profiles = Array.isArray(registry.profiles) ? registry.profiles : [];

function profilePaperclipEnabled(profile) {
  try {
    const config = JSON.parse(readFileSync(`${profile.home}/cortexos-profile.json`, "utf8"));
    if (config.paperclip?.enabled === false) return false;
  } catch {
    // Missing profile metadata should not hide a profile from Paperclip checks.
  }
  return profile.paperclip?.enabled !== false;
}

const paperclipProfiles = profiles.filter(profilePaperclipEnabled);
const requiredProfiles = (process.env.CORTEX_REQUIRED_HERMES_PROFILES || paperclipProfiles.map((profile) => profile.profile).join(","))
  .split(",")
  .map((profile) => profile.trim())
  .filter(Boolean);
const runHermes = process.env.HERMES_SMOKE_RUN === "1";
const paperclipUrl = process.env.PAPERCLIP_API_URL?.replace(/\/$/, "");
const paperclipApiUrl =
  paperclipUrl && paperclipUrl.endsWith("/api") ? paperclipUrl : paperclipUrl ? `${paperclipUrl}/api` : "";
const paperclipKey = process.env.PAPERCLIP_API_KEY || "";
const companyId = process.env.PAPERCLIP_COMPANY_ID || "";
const requireHeartbeat = process.env.PAPERCLIP_REQUIRE_HEARTBEAT === "1";

function ok(name, extra = {}) {
  console.log(JSON.stringify({ ok: true, check: name, ...extra }));
}

function fail(name, message) {
  console.error(JSON.stringify({ ok: false, check: name, error: message }));
  process.exitCode = 1;
}

function plainValue(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

try {
  execFileSync("hermes", ["--version"], { stdio: "ignore" });
  ok("hermes-cli");
} catch (error) {
  fail("hermes-cli", "hermes command is not available");
}

for (const profile of profiles) {
  try {
    const envText = readFileSync(profile.secretPath, "utf8");
    if (!envText.includes(`HERMES_PROFILE=${profile.profile}`)) {
      throw new Error(`profile env mismatch in ${profile.secretPath}`);
    }
    ok("profile-env", { profile: profile.profile });
    if (!profilePaperclipEnabled(profile)) ok("profile-paperclip-skipped", { profile: profile.profile });
    if (runHermes) {
      const prompt = `CortexOS smoke test for profile ${profile.profile}. Reply with exactly: ok`;
      execFileSync("hermes", ["chat", "-q", prompt], {
        env: { ...process.env, HERMES_HOME: profile.home, HERMES_PROFILE: profile.profile },
        stdio: "pipe",
        timeout: 120000,
      });
      ok("hermes-chat", { profile: profile.profile });
    }
  } catch (error) {
    fail("profile", error instanceof Error ? error.message : String(error));
  }
}

if (paperclipApiUrl && paperclipKey && companyId) {
  const headers = { authorization: `Bearer ${paperclipKey}` };
  const companyIds = new Set([companyId]);
  const meRes = await fetch(`${paperclipApiUrl}/cli-auth/me`, { headers });
  if (meRes.ok) {
    const me = await meRes.json();
    for (const id of me.companyIds || []) companyIds.add(id);
  }

  const hermesAgents = [];
  for (const id of companyIds) {
    const res = await fetch(`${paperclipApiUrl}/companies/${encodeURIComponent(id)}/agents`, { headers });
    if (!res.ok) {
      fail("paperclip-agents", `company ${id} HTTP ${res.status}`);
      continue;
    }
    const body = await res.json();
    const list = Array.isArray(body) ? body : body.agents || [];
    hermesAgents.push(
      ...list.filter((agent) => agent.adapterType === "hermes_local" || agent.adapter?.type === "hermes_local"),
    );
  }

  if (hermesAgents.length === 0) fail("paperclip-hermes-agents", "no hermes_local agents registered");
  else ok("paperclip-hermes-agents", { count: hermesAgents.length, companies: companyIds.size });

  const profiles = new Set(
    hermesAgents
      .map((agent) => agent.adapterConfig?.profile || plainValue(agent.adapterConfig?.env?.HERMES_PROFILE))
      .filter(Boolean),
  );
  const expectedProfiles = process.env.CORTEX_REQUIRED_HERMES_PROFILES
    ? requiredProfiles
    : [...profiles].sort();
  for (const requiredProfile of expectedProfiles) {
    if (!profiles.has(requiredProfile)) {
      fail("paperclip-hermes-profile", `missing ${requiredProfile} hermes_local agent`);
    } else {
      ok("paperclip-hermes-profile", { profile: requiredProfile });
    }
  }

  const invalidSchedules = hermesAgents.filter((agent) => {
    const heartbeat = agent.runtimeConfig?.heartbeat;
    if (!heartbeat?.enabled) return false;
    return Number(heartbeat.intervalSec || 0) <= 0;
  });
  const invalidAdapterConfigs = hermesAgents.filter((agent) => {
    const config = agent.adapterConfig || {};
    const env = config.env || {};
    if (config.provider && config.provider !== "auto") return true;
    if (!Array.isArray(config.extraArgs) || config.extraArgs.join(" ") !== "--provider 9router") return true;
    if (Number(config.timeoutSec || 0) < 1800) return true;
    if (env.OPENROUTER_API_KEY || env.OPENROUTER_BASE_URL || env.OPENAI_API_KEY) return true;
    return false;
  });
  const disabledSchedules = hermesAgents.filter((agent) => agent.runtimeConfig?.heartbeat?.enabled !== true);
  if (invalidAdapterConfigs.length) {
    fail(
      "paperclip-hermes-adapter-config",
      `${invalidAdapterConfigs.length} hermes_local agents are not using the 9Router adapter contract`,
    );
  } else if (invalidSchedules.length) {
    fail(
      "paperclip-hermes-schedules",
      `${invalidSchedules.length} hermes_local agents have enabled heartbeat schedules with invalid intervals`,
    );
  } else if (requireHeartbeat && disabledSchedules.length) {
    fail(
      "paperclip-hermes-schedules",
      `${disabledSchedules.length} hermes_local agents have disabled heartbeat schedules`,
    );
  } else {
    ok("paperclip-hermes-schedules", { enabled: hermesAgents.length - disabledSchedules.length, disabled: disabledSchedules.length });
  }
} else {
  ok("paperclip-api-skipped", { reason: "PAPERCLIP_API_URL, PAPERCLIP_API_KEY, or PAPERCLIP_COMPANY_ID not set" });
}
