import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  setSecretStagingDir,
  requiredSecretKeys,
  isAllowedSecretKey,
  stageSecret,
  listStagedSecretKeys,
  readStagedSecrets,
  clearStagedSecrets,
} from "@/server/agents/generator/secretStaging";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "secstage-"));
  setSecretStagingDir(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("requiredSecretKeys", () => {
  it("collects mcps[].env keys and the telegram slot", () => {
    const keys = requiredSecretKeys({
      mcps: [
        { name: "jira-pantone", env: { JIRA_API_TOKEN: "", OTHER_KEY: "" } },
        { name: "granola", env: {} },
      ],
      telegramBotToken: "",
    } as never);
    expect(new Set(keys)).toEqual(new Set(["JIRA_API_TOKEN", "OTHER_KEY", "TELEGRAM_BOT_TOKEN"]));
  });

  it("omits telegram when telegramBotToken is absent", () => {
    expect(requiredSecretKeys({ mcps: [{ name: "x", env: { K: "" } }] } as never)).toEqual(["K"]);
  });

  it("ignores invalid env names", () => {
    expect(requiredSecretKeys({ mcps: [{ name: "x", env: { "bad-key": "", GOOD: "" } }] } as never)).toEqual([
      "GOOD",
    ]);
  });
});

describe("isAllowedSecretKey", () => {
  const spec = { mcps: [{ name: "x", env: { JIRA_API_TOKEN: "" } }] } as never;
  it("accepts a declared key", () => {
    expect(isAllowedSecretKey(spec, "JIRA_API_TOKEN")).toBe(true);
  });
  it("rejects an undeclared key (injection guard)", () => {
    expect(isAllowedSecretKey(spec, "AWS_SECRET_ACCESS_KEY")).toBe(false);
  });
  it("rejects a syntactically invalid key", () => {
    expect(isAllowedSecretKey(spec, "lowercase")).toBe(false);
  });
});

describe("stageSecret / read / list / clear", () => {
  it("stages a value, lists only the key name, reads the value back", async () => {
    const staged = await stageSecret(1, "JIRA_API_TOKEN", "super-secret-value");
    expect(staged).toEqual(["JIRA_API_TOKEN"]);
    expect(await listStagedSecretKeys(1)).toEqual(["JIRA_API_TOKEN"]);
    const map = await readStagedSecrets(1);
    expect(map.get("JIRA_API_TOKEN")).toBe("super-secret-value");
  });

  it("upserts and keeps multiple keys isolated per session", async () => {
    await stageSecret(1, "A_TOKEN", "one");
    await stageSecret(1, "B_TOKEN", "two");
    await stageSecret(2, "A_TOKEN", "other-session");
    expect(new Set(await listStagedSecretKeys(1))).toEqual(new Set(["A_TOKEN", "B_TOKEN"]));
    expect((await readStagedSecrets(1)).get("A_TOKEN")).toBe("one");
    expect((await readStagedSecrets(2)).get("A_TOKEN")).toBe("other-session");
  });

  it("overwrites an existing key value", async () => {
    await stageSecret(1, "T", "v1");
    await stageSecret(1, "T", "v2");
    expect((await readStagedSecrets(1)).get("T")).toBe("v2");
  });

  it("rejects a value containing a newline (env-line injection)", async () => {
    await expect(stageSecret(1, "T", "a\nADMIN=true")).rejects.toThrow(/newline/);
  });

  it("rejects an invalid key name", async () => {
    await expect(stageSecret(1, "bad-key", "v")).rejects.toThrow(/invalid secret key/);
  });

  it("writes the staging file at mode 0600", async () => {
    await stageSecret(7, "T", "v");
    const p = path.join(dir, ".staging", "7.env");
    const st = await stat(p);
    expect(st.mode & 0o777).toBe(0o600);
    // sanity: the value is on disk (this is the documented tradeoff)
    expect(await readFile(p, "utf8")).toContain("T=v");
  });

  it("clears the staging file", async () => {
    await stageSecret(1, "T", "v");
    await clearStagedSecrets(1);
    expect(await listStagedSecretKeys(1)).toEqual([]);
  });

  it("returns empty for a session with no staged secrets", async () => {
    expect(await listStagedSecretKeys(999)).toEqual([]);
    expect((await readStagedSecrets(999)).size).toBe(0);
  });
});
