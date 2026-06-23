// @vitest-environment node
/**
 * Correctness tests for the generator LLM client (llm.ts) and the
 * agentGenerator repo (repos/agentGenerator.ts).
 *
 * Covers:
 *   #1  attachments attach only to the LAST user message in history
 *   #2  image content parts carry a `data:` URL prefix, not raw base64
 *   #7  createSession throws cleanly when .returning() yields an empty array
 *   #8  appendBuildLogs uses SQL-side concatenation (no read-modify-write race)
 */

import { describe, it, expect, vi } from "vitest";

// ─── #1 + #2: llm.ts generatorTurn message construction ────────────────────

/**
 * We test the behaviour of generatorTurn by mocking `generateText` from the
 * `ai` SDK and inspecting the `messages` array it receives.  We also mock the
 * 9router env read so the client can be constructed without a real secrets
 * file.
 */
describe("generatorTurn — attachment scoping", () => {
  it("#1: attachments are applied only to the final user message, not history turns", async () => {
    let capturedMessages: unknown[] | null = null;

    vi.doMock("ai", async (importOriginal) => {
      const actual = await importOriginal<typeof import("ai")>();
      return {
        ...actual,
        generateText: vi.fn(async (opts: { messages: unknown[] }) => {
          capturedMessages = opts.messages;
          return { text: "ok" };
        }),
      };
    });
    vi.doMock("@ai-sdk/openai", () => ({
      createOpenAI: () => (model: string) => model,
    }));
    vi.doMock("@/server/agents/chat", () => ({
      readEnvValue: () => "sk-test",
    }));
    vi.doMock("@/server/agents/nineRouter", () => ({
      nineRouterBaseUrl: () => "http://127.0.0.1:11434",
    }));

    const { generatorTurn } = await import("@/server/agents/generator/llm");

    await generatorTurn({
      model: "test-model",
      reasoning: "medium",
      messages: [
        { role: "user", content: "first message" },
        { role: "assistant", content: "first reply" },
        { role: "user", content: "second message with attachment" },
      ],
      attachments: [{ filename: "img.png", mime: "image/png", dataBase64: "AAAA" }],
      specSoFar: {},
    });

    expect(capturedMessages).not.toBeNull();
    // messages = [system, ...history]; find all user messages
    const userMessages = (
      capturedMessages as unknown as Array<{ role: string; content: unknown }>
    ).filter((m) => m.role === "user");
    expect(userMessages).toHaveLength(2);

    // First user message must be plain text (no attachment parts)
    expect(typeof userMessages[0]!.content).toBe("string");
    expect(userMessages[0]!.content).toBe("first message");

    // Last user message must include both a text part and an image part
    const lastContent = userMessages[1]!.content;
    expect(Array.isArray(lastContent)).toBe(true);
    const parts = lastContent as Array<{ type: string }>;
    expect(parts.some((p) => p.type === "text")).toBe(true);
    expect(parts.some((p) => p.type === "image")).toBe(true);

    vi.resetModules();
  });

  it("#2: image content parts carry a data: URL, not raw base64", async () => {
    let capturedMessages: unknown[] | null = null;

    vi.doMock("ai", async (importOriginal) => {
      const actual = await importOriginal<typeof import("ai")>();
      return {
        ...actual,
        generateText: vi.fn(async (opts: { messages: unknown[] }) => {
          capturedMessages = opts.messages;
          return { text: "ok" };
        }),
      };
    });
    vi.doMock("@ai-sdk/openai", () => ({
      createOpenAI: () => (model: string) => model,
    }));
    vi.doMock("@/server/agents/chat", () => ({
      readEnvValue: () => "sk-test",
    }));
    vi.doMock("@/server/agents/nineRouter", () => ({
      nineRouterBaseUrl: () => "http://127.0.0.1:11434",
    }));

    const { generatorTurn } = await import("@/server/agents/generator/llm");

    await generatorTurn({
      model: "test-model",
      reasoning: "medium",
      messages: [{ role: "user", content: "look at this" }],
      attachments: [{ filename: "photo.jpg", mime: "image/jpeg", dataBase64: "BASE64DATA" }],
      specSoFar: {},
    });

    expect(capturedMessages).not.toBeNull();
    const userMsgs = (
      capturedMessages as unknown as Array<{ role: string; content: unknown }>
    ).filter((m) => m.role === "user");
    const parts = userMsgs.at(-1)!.content as Array<{ type: string; image?: string }>;
    const imagePart = parts.find((p) => p.type === "image");
    expect(imagePart).toBeDefined();
    // Must be a data: URL, not raw base64
    expect(imagePart!.image).toBe("data:image/jpeg;base64,BASE64DATA");
    expect(imagePart!.image).not.toBe("BASE64DATA");

    vi.resetModules();
  });
});

// ─── #7: createSession throws on empty .returning() ─────────────────────────

describe("createSession — empty .returning() guard", () => {
  it("#7: throws a clear error when the DB insert returns no rows", async () => {
    // Build a minimal fake DrizzleORM client where .returning() yields [].
    const fakeDb = {
      insert: () => ({
        values: () => ({
          returning: async () => [],
        }),
      }),
    } as unknown as import("@/server/db/client").DbClient;

    const { createSession } = await import("@/server/db/repos/agentGenerator");
    await expect(
      createSession(fakeDb, { model: "test-model", reasoning: "medium" }),
    ).rejects.toThrow("createSession: DB insert returned no rows");
  });

  it("#7: returns the inserted row when the DB insert succeeds", async () => {
    const fakeRow = {
      id: 42,
      slug: null,
      status: "draft",
      model: "test-model",
      reasoning: "medium",
      transcript: [],
      spec: {},
      buildLogs: "",
      createdBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fakeDb = {
      insert: () => ({
        values: () => ({
          returning: async () => [fakeRow],
        }),
      }),
    } as unknown as import("@/server/db/client").DbClient;

    const { createSession } = await import("@/server/db/repos/agentGenerator");
    const result = await createSession(fakeDb, { model: "test-model", reasoning: "medium" });
    expect(result.id).toBe(42);
    expect(result.model).toBe("test-model");
  });
});

// ─── #8: appendBuildLogs uses SQL-side concatenation ────────────────────────

describe("appendBuildLogs — SQL-side atomic append", () => {
  it("#8: passes a SQL expression (not a plain string) for buildLogs", async () => {
    // Capture what drizzle's .set() receives so we can assert it's a SQL
    // object rather than a pre-read string value.
    let capturedSet: Record<string, unknown> | null = null;

    const fakeDb = {
      update: () => ({
        set: (values: Record<string, unknown>) => {
          capturedSet = values;
          return {
            where: () => ({
              returning: async () => [{ id: 1 }],
            }),
          };
        },
      }),
    } as unknown as import("@/server/db/client").DbClient;

    const { appendBuildLogs } = await import("@/server/db/repos/agentGenerator");
    await appendBuildLogs(fakeDb, 1, "some log line\n");

    expect(capturedSet).not.toBeNull();
    // The buildLogs value must be a SQL expression object (has a queryChunks or
    // sql property), NOT a plain string — that's the proof the read-modify-write
    // was eliminated.
    const buildLogsValue = capturedSet!["buildLogs"];
    expect(typeof buildLogsValue).not.toBe("string");
    // drizzle sql template literals produce objects with an `sql` property or
    // a `queryChunks` array; either form is acceptable.
    expect(buildLogsValue).toBeTruthy();
    expect(typeof buildLogsValue).toBe("object");
  });

  it("#8: concurrent appends each issue their own UPDATE without a prior SELECT", async () => {
    // Verify appendBuildLogs does NOT call getSession (no SELECT) — if it did,
    // it would still have the read-modify-write race.
    const selectCalls: number[] = [];
    const updateCalls: string[] = [];

    const fakeDb = {
      select: () => {
        selectCalls.push(1);
        return { from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) };
      },
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              updateCalls.push("update");
              return [{ id: 1 }];
            },
          }),
        }),
      }),
    } as unknown as import("@/server/db/client").DbClient;

    const { appendBuildLogs } = await import("@/server/db/repos/agentGenerator");

    // Fire three concurrent appends
    await Promise.all([
      appendBuildLogs(fakeDb, 1, "line-a\n"),
      appendBuildLogs(fakeDb, 1, "line-b\n"),
      appendBuildLogs(fakeDb, 1, "line-c\n"),
    ]);

    // No SELECT should have been issued (no read-modify-write)
    expect(selectCalls).toHaveLength(0);
    // All three UPDATEs must have been issued
    expect(updateCalls).toHaveLength(3);
  });
});
