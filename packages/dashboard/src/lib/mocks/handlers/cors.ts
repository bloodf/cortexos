/**
 * CORS headers for MSW responses. SvelteKit's dev server proxies
 * fetches through, but tests that hit the dev server directly with
 * a different origin still need these.
 */

export function corsHeaders(): Headers {
	const headers = new Headers();
	headers.set('Access-Control-Allow-Origin', '*');
	headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
	headers.set(
		'Access-Control-Allow-Headers',
		'x-mock-scenario, content-type, authorization, x-cortex-confirmation-token, x-cortex-delete-confirm, x-incus-delete-confirm',
	);
	headers.set('Access-Control-Max-Age', '86400');
	return headers;
}
