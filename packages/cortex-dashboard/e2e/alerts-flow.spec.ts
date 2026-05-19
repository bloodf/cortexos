/**
 * V11 — E2E: alerts → Paperclip notification.
 *
 * Posts to `/api/paperclip/notify-test` with `X-Admin-Token`, then
 * asserts the upstream Paperclip notification was registered via the
 * bridge's `/paperclip/notifications/recent` endpoint. Requires live
 * NATS + bridge — marked `fixme` when env not provided.
 */
import { test, expect } from "@playwright/test";

const ADMIN_TOKEN = process.env.E2E_ADMIN_TOKEN;
const BRIDGE_URL = process.env.PAPERCLIP_BRIDGE_URL;

test.describe("alerts flow", () => {
	test.beforeEach(async () => {
		if (!ADMIN_TOKEN || !BRIDGE_URL) {
			test.fixme(
				true,
				"E2E_ADMIN_TOKEN and PAPERCLIP_BRIDGE_URL required for alerts E2E.",
			);
		}
	});

	test("fire test alert, confirm Paperclip notification", async ({ request }) => {
		const title = `e2e-alert-${Date.now()}`;
		const res = await request.post("/api/paperclip/notify-test", {
			headers: { "x-admin-token": ADMIN_TOKEN! },
			data: { title, source: "e2e" },
		});
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.ok).toBeTruthy();
		expect(body.subject).toMatch(/^cortex\.alerts\.critical\./);

		// Poll bridge for the matching notification.
		const deadline = Date.now() + 20_000;
		let seen = false;
		while (Date.now() < deadline) {
			const r = await request.get(
				`${BRIDGE_URL}/paperclip/notifications/recent`,
			);
			if (r.ok()) {
				const json = (await r.json()) as { items?: Array<{ title?: string }> };
				if (json.items?.some((i) => i.title === title)) {
					seen = true;
					break;
				}
			}
			await new Promise((res) => setTimeout(res, 1000));
		}
		expect(seen).toBeTruthy();
	});
});
