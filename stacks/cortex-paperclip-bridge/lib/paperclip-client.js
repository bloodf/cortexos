import { fetch } from "undici";

const DEFAULT_TIMEOUT_MS = 10_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class PaperclipClient {
  constructor({ baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    if (!baseUrl) throw new Error("PaperclipClient: baseUrl required");
    if (!token) throw new Error("PaperclipClient: token required");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.timeoutMs = timeoutMs;
  }

  authHeaders(runId) {
    const h = {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
    if (runId) h["X-Paperclip-Run-Id"] = runId;
    return h;
  }

  async request(method, path, { runId, body, retryOn5xx = true, maxAttempts = 6 } = {}) {
    const url = `${this.baseUrl}${path}`;
    let attempt = 0;
    let lastErr = null;
    while (attempt < maxAttempts) {
      attempt++;
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers: this.authHeaders(runId),
          body: body ? JSON.stringify(body) : undefined,
          signal: ac.signal,
        });
        clearTimeout(t);
        if (res.status === 409) {
          return { status: 409, ok: false, body: await safeJson(res) };
        }
        if (res.status >= 500 && retryOn5xx && attempt < maxAttempts) {
          await sleep(backoff(attempt));
          continue;
        }
        const payload = await safeJson(res);
        return { status: res.status, ok: res.ok, body: payload };
      } catch (e) {
        clearTimeout(t);
        lastErr = e;
        if (attempt >= maxAttempts) break;
        await sleep(backoff(attempt));
      }
    }
    throw new Error(`paperclip ${method} ${path} failed after ${maxAttempts}: ${lastErr?.message || "unknown"}`);
  }

  getMe() {
    return this.request("GET", "/api/agents/me");
  }

  inboxLite() {
    return this.request("GET", "/api/agents/me/inbox-lite");
  }

  checkout(issueId, runId) {
    return this.request("POST", `/api/issues/${encodeURIComponent(issueId)}/checkout`, {
      runId,
      body: {},
      retryOn5xx: false,
      maxAttempts: 1,
    });
  }

  patchIssue(issueId, body, runId) {
    return this.request("PATCH", `/api/issues/${encodeURIComponent(issueId)}`, { runId, body });
  }

  mintAgentKey(agentId) {
    return this.request("POST", `/api/agents/${encodeURIComponent(agentId)}/keys`, { body: {} });
  }

  createAgentHire(companyId, body) {
    return this.request("POST", `/api/companies/${encodeURIComponent(companyId)}/agent-hires`, { body });
  }

  approveApproval(approvalId) {
    return this.request("POST", `/api/approvals/${encodeURIComponent(approvalId)}/approve`, { body: {} });
  }
}

function backoff(attempt) {
  const base = 1000 * Math.pow(2, attempt - 1);
  return Math.min(base, 5 * 60 * 1000);
}

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
