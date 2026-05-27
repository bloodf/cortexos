#!/usr/bin/env node
import { readFileSync } from "node:fs";

const envPath = process.env.PAPERCLIP_ENV_FILE || "/opt/cortexos/.secrets/paperclip.env";
const apply = process.argv.includes("--apply");
const recoveryStamp = process.env.PAPERCLIP_RECOVERY_STAMP || "2026-05-27-hermes-fallback-recovery";
const paperclipApiUrl = (process.env.PAPERCLIP_API_URL || readEnvFile(envPath).PAPERCLIP_API_URL || "http://127.0.0.1:3033").replace(/\/$/, "");
const paperclipApiKey = process.env.PAPERCLIP_API_KEY || readEnvFile(envPath).PAPERCLIP_API_KEY || "";
const OPEN_STATUSES = new Set(["backlog", "todo", "in_progress", "in_review", "blocked"]);
const TERMINAL_RUN_STATUSES = new Set(["failed", "timed_out", "cancelled"]);

if (!paperclipApiKey) throw new Error(`PAPERCLIP_API_KEY missing; set it or provide ${envPath}`);

function readEnvFile(path) {
  const out = {};
  try {
    for (const rawLine of readFileSync(path, "utf8").split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const idx = line.indexOf("=");
      if (idx < 1) continue;
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  } catch {
    return out;
  }
  return out;
}

async function api(path, options = {}) {
  const res = await fetch(`${paperclipApiUrl}/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${paperclipApiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed HTTP ${res.status}: ${text}`);
  }
  return body;
}

async function listAllIssues(companyId) {
  const issues = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await api(`/companies/${companyId}/issues?limit=1000&offset=${offset}&includeBlockedBy=true`);
    issues.push(...page);
    if (page.length < 1000) break;
  }
  return issues;
}

function issueRunId(run) {
  const context = run?.contextSnapshot || {};
  return typeof context.issueId === "string" ? context.issueId : typeof context.taskId === "string" ? context.taskId : null;
}

function hasUnresolvedBlocker(issue) {
  return (issue.blockedBy || []).some((blocker) => !["done", "cancelled"].includes(blocker.status));
}

function needsRecovery(issue, latestRun) {
  if (!issue.assigneeAgentId || !OPEN_STATUSES.has(issue.status)) return false;
  if (issue.status === "blocked") return !hasUnresolvedBlocker(issue);
  return latestRun ? TERMINAL_RUN_STATUSES.has(latestRun.status) : false;
}

function nextIssuePatch(issue, latestRun) {
  const reason = issue.status === "blocked"
    ? "Unblocked by CortexOS recovery after Hermes model fallback repair."
    : `Restarting after latest agent run ended with ${latestRun?.status || "an error"}.`;
  return {
    status: issue.status === "blocked" || issue.status === "backlog" || issue.status === "in_progress" ? "todo" : issue.status,
    comment: `${reason}\n\nRecovery stamp: ${recoveryStamp}`,
  };
}

async function main() {
  const me = await api("/cli-auth/me");
  const companies = (me.memberships || [])
    .map((membership) => ({ id: membership.companyId, name: membership.company?.name || membership.companyId }))
    .filter((company) => company.id);
  const summary = [];

  for (const company of companies) {
    const [agents, issues, runs] = await Promise.all([
      api(`/companies/${company.id}/agents`),
      listAllIssues(company.id),
      api(`/companies/${company.id}/heartbeat-runs?limit=1000`),
    ]);

    const latestRunByIssue = new Map();
    for (const run of runs) {
      const issueId = issueRunId(run);
      if (issueId && !latestRunByIssue.has(issueId)) latestRunByIssue.set(issueId, run);
    }

    const errorAgents = agents.filter((agent) => agent.adapterType === "hermes_local" && agent.status === "error");
    const recoverableIssues = issues.filter((issue) => needsRecovery(issue, latestRunByIssue.get(issue.id)));
    const skippedBlockedWithUnresolvedBlockers = issues.filter((issue) => issue.status === "blocked" && hasUnresolvedBlocker(issue));
    const activeSkipped = [];
    const activeResumed = [];
    const recoveredIssues = [];
    const wakeups = [];

    if (apply) {
      for (const agent of errorAgents) {
        await api(`/agents/${agent.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "idle" }),
        });
      }
    }

    for (const issue of recoverableIssues) {
      const activeRun = await api(`/issues/${issue.id}/active-run`);
      if (activeRun) {
        const latestRun = latestRunByIssue.get(issue.id);
        const activePatch = {
          status: "in_progress",
          comment: `Cleared stale blocked status while Paperclip run ${activeRun.id} is already active.\n\nRecovery stamp: ${recoveryStamp}`,
        };
        activeResumed.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          fromStatus: issue.status,
          toStatus: activePatch.status,
          assigneeAgentId: issue.assigneeAgentId,
          activeRunId: activeRun.id,
          runStatus: activeRun.status,
          latestRunStatus: latestRun?.status || null,
          latestRunId: latestRun?.id || null,
        });
        if (apply) {
          await api(`/issues/${issue.id}`, {
            method: "PATCH",
            body: JSON.stringify(activePatch),
          });
        }
        continue;
      }

      const latestRun = latestRunByIssue.get(issue.id);
      const patch = nextIssuePatch(issue, latestRun);
      recoveredIssues.push({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        fromStatus: issue.status,
        toStatus: patch.status,
        assigneeAgentId: issue.assigneeAgentId,
        latestRunStatus: latestRun?.status || null,
        latestRunId: latestRun?.id || null,
      });

      if (apply) {
        await api(`/issues/${issue.id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        const wake = await api(`/agents/${issue.assigneeAgentId}/wakeup`, {
          method: "POST",
          body: JSON.stringify({
            source: "automation",
            triggerDetail: "system",
            reason: "cortex_recovery_restart_issue",
            payload: {
              issueId: issue.id,
              recoveryStamp,
              previousStatus: issue.status,
              latestRunId: latestRun?.id || null,
            },
            idempotencyKey: `${recoveryStamp}:${issue.id}`,
            forceFreshSession: true,
          }),
        });
        wakeups.push({
          issueId: issue.id,
          identifier: issue.identifier,
          responseStatus: wake?.status || null,
          runId: wake?.id || null,
        });
      }
    }

    summary.push({
      company: company.name,
      companyId: company.id,
      hermesErrorAgents: errorAgents.length,
      recoverableIssues: recoverableIssues.length,
      recoveredIssues: recoveredIssues.length,
      activeResumed: activeResumed.length,
      activeSkipped: activeSkipped.length,
      skippedBlockedWithUnresolvedBlockers: skippedBlockedWithUnresolvedBlockers.length,
      issueStatusCounts: issues.reduce((acc, issue) => {
        acc[issue.status] = (acc[issue.status] || 0) + 1;
        return acc;
      }, {}),
      recoveredIssueSamples: recoveredIssues.slice(0, 20),
      activeResumedSamples: activeResumed.slice(0, 20),
      activeSkippedSamples: activeSkipped.slice(0, 20),
      wakeups: wakeups.slice(0, 20),
    });
  }

  console.log(JSON.stringify({ apply, recoveryStamp, companies: summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
