/**
 * V11 — E2E: audit viewer chain-verify badge.
 *
 * Loads `/[locale]/audit`, waits for the `chain-verify-badge`, and
 * asserts it lands in the "green" state. Requires the dashboard admin
 * session — see `E2E_ADMIN_COOKIE` env var. When unset, marked `fixme`.
 */
import { test, expect } from "@playwright/test";

const ADMIN_COOKIE = process.env.E2E_ADMIN_COOKIE;
const LOCALE = process.env.E2E_LOCALE ?? "en";

test.describe("audit viewer", () => {
	test.beforeEach(async ({ context }) => {
		if (!ADMIN_COOKIE) {
			test.fixme(
				true,
				"E2E_ADMIN_COOKIE not set — audit viewer requires an admin session.",
			);
			return;
		}
		await context.addCookies([
			{
				name: "cortex_session",
				value: ADMIN_COOKIE,
				url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3080",
			},
		]);
	});

	test("chain-verify badge renders green", async ({ page }) => {
		await page.goto(`/${LOCALE}/audit`);
		await expect(
			page.getByRole("heading", { name: "Audit Log" }),
		).toBeVisible();

		const badge = page.getByTestId("audit-chain-verify-badge");
		await expect(badge).toBeVisible({ timeout: 15_000 });
		// Either explicit "valid"/"verified" text or a `data-state=ok` attr.
		const text = (await badge.textContent())?.toLowerCase() ?? "";
		expect(text.includes("valid") || text.includes("verified") || text.includes("ok"))
			.toBeTruthy();
	});
});
