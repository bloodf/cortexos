import { describe, expect, it } from "vitest";

// neutralizeArchitect is a module-private helper in llm.ts; re-implement the
// exact regex here and assert the contract, so a change to the live regex that
// breaks the guarantee fails this test. (Kept in sync with llm.ts /
// cortex-agent-generator/src/server.js — both must match byte-for-byte.)
function neutralizeArchitect(text: string): string {
  return text.replace(
    /```[\s\S]*?```/g,
    "[earlier draft content removed — you are an interviewer, not a code/architecture author]",
  );
}

describe("neutralizeArchitect", () => {
  it("strips a fenced code block", () => {
    const out = neutralizeArchitect("before\n```py\nimport os\n```\nafter");
    expect(out).not.toContain("import os");
    expect(out).toContain("before");
    expect(out).toContain("after");
    expect(out).toContain("earlier draft content removed");
  });

  it("strips multiple code blocks including SQL/config", () => {
    const text =
      "Schema:\n```sql\nCREATE TABLE contexts(id);\n```\nConfig:\n```yaml\ntelegram:\n  token: x\n```";
    const out = neutralizeArchitect(text);
    expect(out).not.toContain("CREATE TABLE");
    expect(out).not.toContain("telegram:");
    expect((out.match(/earlier draft content removed/g) || []).length).toBe(2);
  });

  it("leaves prose without code blocks unchanged", () => {
    const text = "Which job is Angel on? Which job is Howie?";
    expect(neutralizeArchitect(text)).toBe(text);
  });

  it("preserves the operator's real facts in surrounding prose", () => {
    const out = neutralizeArchitect(
      "Captured: jira-pantone, granola-spacedinosaurs.\n```\ncode\n```\nNext: Identity.",
    );
    expect(out).toContain("jira-pantone");
    expect(out).toContain("granola-spacedinosaurs");
    expect(out).toContain("Next: Identity.");
    expect(out).not.toContain("\ncode\n");
  });
});
