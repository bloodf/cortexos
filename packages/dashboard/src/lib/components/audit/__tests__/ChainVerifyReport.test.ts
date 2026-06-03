/**
 * ChainVerifyReport.test.ts — banner + dl list for both ok / broken.
 */
import { describe, it, expect, afterEach } from 'vitest';
import type { ComponentProps } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import ChainVerifyReport from '../ChainVerifyReport.svelte';
import { testMessages } from './messages';
import type { AuditVerifyResult } from '$lib/server/audit';

afterEach(cleanup);

type ReportProps = ComponentProps<typeof ChainVerifyReport>;

function renderReport(result: AuditVerifyResult, length: number) {
	return render(ChainVerifyReport, { props: { result, length, messages: testMessages } as ReportProps });
}

describe('ChainVerifyReport', () => {
	it('renders the success banner + chain length when ok', () => {
		const result: AuditVerifyResult = { ok: true, length: 12 };
		const { container } = renderReport(result, 12);
		const root = container.querySelector('[data-slot="chain-verify-report"]');
		expect(root).not.toBeNull();
		expect(root?.getAttribute('data-chain-ok')).toBe('true');
		expect(container.textContent).toContain('Chain valid');
		expect(container.textContent).toContain('12');
	});

	it('renders the broken banner + failure details when not ok', () => {
		const result: AuditVerifyResult = { ok: false, index: 4, reason: 'prevHash mismatch' };
		const { container } = renderReport(result, 9);
		const root = container.querySelector('[data-slot="chain-verify-report"]');
		expect(root?.getAttribute('data-chain-ok')).toBe('false');
		expect(container.textContent).toContain('BROKEN');
		expect(container.textContent).toContain('prevHash mismatch');
	});

	it('shows the status as OK / BROKEN in the dl', () => {
		const ok: AuditVerifyResult = { ok: true, length: 3 };
		const { container: c1 } = renderReport(ok, 3);
		expect(c1.textContent).toContain('OK');

		const broken: AuditVerifyResult = { ok: false, index: 1, reason: 'r' };
		const { container: c2 } = renderReport(broken, 3);
		expect(c2.textContent).toContain('BROKEN');
	});
});
