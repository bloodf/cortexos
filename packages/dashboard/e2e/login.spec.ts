import { expect, test } from '@playwright/test';

/**
 * E2E shell test — exercises the public surface of the M1 scaffold:
 *   - `/` redirects anonymous users to /login.
 *   - `/login` renders the form, the inputs, and the submit button.
 *   - The login page exposes the `data-testid="login-form"` hook used
 *     by the unit tests and downstream suites.
 *
 * Real authentication lands in M3; this test only verifies the
 * shell renders and the form is reachable.
 */
test.describe('M1 shell', () => {
	test('root redirects to /login when not authenticated', async ({ page }) => {
		const response = await page.goto('/');
		// 303 → /login (or a 200 once Playwright follows the redirect).
		expect(response).toBeTruthy();
		await expect(page).toHaveURL(/\/login(\?.*)?$/);
	});

	test('login form is visible and addressable', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByTestId('login-form')).toBeVisible();
		await expect(page.getByLabel(/username/i)).toBeVisible();
		await expect(page.getByLabel(/password/i)).toBeVisible();
		await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
	});

	test('submitting with empty fields shows the validation error', async ({ page }) => {
		await page.goto('/login');
		// HTML5 `required` blocks the form; bypass by removing the
		// attribute so the server-side guard can be exercised.
		await page.evaluate(() => {
			document.querySelectorAll<HTMLInputElement>('input[required]').forEach((el) => {
				el.removeAttribute('required');
			});
		});
		await page.getByRole('button', { name: /sign in/i }).click();
		await expect(page.getByTestId('login-error')).toBeVisible();
	});
});
