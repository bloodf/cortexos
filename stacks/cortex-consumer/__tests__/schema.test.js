// Unit test for consumer.js schema loader + dual-validation.
// Run via: `npm test` inside stacks/cortex-consumer (uses node --test).
//
// Covers M-6: ensures the canonical block schema at templates/messages/schema.json
// is loaded via the "messages.blocks" alias, accepts a well-formed blocks
// payload, and rejects a malformed one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
process.env.CORTEX_TEMPLATES_DIR = resolve(repoRoot, "templates");

const { loadSchema, validatePayload } = await import("../consumer.js");

test("loadSchema resolves messages.blocks via CORTEX_TEMPLATES_DIR", () => {
	const schema = loadSchema("messages.blocks");
	assert.ok(schema, "schema must load");
	assert.equal(schema.title, "CortexOS Canonical Rich-Block Envelope");
	assert.deepEqual(schema.required, ["schema_version", "header", "sections", "context"]);
});

test("validatePayload accepts a well-formed blocks payload", async () => {
	const good = {
		schema_version: 1,
		header: { emoji: "✅", title: "Factory: demo", subtitle: "stage: build" },
		sections: [
			{
				type: "kv",
				items: [
					["Slug", "demo"],
					["Stage", "build"],
				],
			},
		],
		context: {
			factory_slug: "demo",
			stage: "build",
			ts: "2026-05-16T00:00:00.000Z",
		},
	};
	const ok = await validatePayload("messages.blocks", good);
	assert.equal(ok, true);
});

test("validatePayload rejects a malformed blocks payload", async () => {
	const bad = {
		// Missing schema_version, header, context; sections wrong type.
		sections: "not-an-array",
	};
	const ok = await validatePayload("messages.blocks", bad);
	assert.equal(ok, false);
});

test("validatePayload still works for nats envelope schemas", async () => {
	const goodEnvelope = {
		ts: "2026-05-16T00:00:00.000Z",
		factory_slug: "demo",
		stage: "build",
	};
	const ok = await validatePayload("cortex.factory.workflow", goodEnvelope);
	assert.equal(ok, true);
});
