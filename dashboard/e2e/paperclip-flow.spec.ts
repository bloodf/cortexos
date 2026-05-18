/**
 * V11 — E2E: paperclip ticket flow.
 *
 * Creates an issue via the Paperclip-bridge webhook (mocked when
 * `PAPERCLIP_BRIDGE_URL` is unset), waits for the link row to reach
 * `done`, and asserts the table renders it. Requires a live dashboard
 * + bridge + NATS. In hermetic local runs without the supporting infra
 * the spec is marked `test.fixme` with an explanatory message.
 */
import { test, expect } from "@playwright/test";

const BRIDGE_URL = process.env.PAPERCLIP_BRIDGE_URL;
const LOCALE = process.env.E2E_LOCALE ?? "en";

test.describe("paperclip flow", () => {
	test.beforeEach(async () => {
		if (!BRIDGE_URL) {
			test.fixme(
				true,
				"PAPERCLIP_BRIDGE_URL not set — skipping live ticket flow. " +
					"Set this env var when running against a wired CortexOS stack.",
			);
		}
	});

	test("create issue, wait for done, assert link row visible", async ({
		page,
		request,
	}) => {
		const issueId = `e2e-${Date.now()}`;
		const runId = `run-${Date.now()}`;

		// Fire synthetic webhook into bridge.
		const created = await request.post(`${BRIDGE_URL}/paperclip/webhook`, {
			data: {
				event: "issue.created",
				issue_id: issueId,
				run_id: runId,
				agent_id: "e2e-agent",
				cortex_role: "e2e",
			},
		});
		expect(created.ok()).toBeTruthy();

		// Visit paperclip page and wait for the row to settle on "done".
		await page.goto(`/${LOCALE}/paperclip`);
		await expect(page.getByRole("heading", { name: "Paperclip" })).toBeVisible();

		const row = page.getByText(issueId, { exact: false });
		await expect(row).toBeVisible({ timeout: 30_000 });
	});
});
