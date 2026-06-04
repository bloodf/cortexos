/**
 * AuditEventDetail.test.ts — sensitive fields are hidden by default,
 * prev/next links render correctly, chain link badge reflects chainLink.
 */
import { describe, it, expect, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import AuditEventDetail from '../AuditEventDetail.svelte';
import { testMessages } from './messages';
import type { AuditEvent } from '$lib/server/entities';
import { asAuditEventId, asUserId } from '$lib/server/entities';

afterEach(cleanup);

function makeEvent(over: Partial<AuditEvent> = {}): AuditEvent {
	return {
		id: asAuditEventId('00000000-0000-4000-8000-000000000002'),
		actorUserId: asUserId('bob'),
		actorSessionId: null,
		actorIp: '10.0.0.5',
		actorUserAgent: 'jest',
		surface: 'services',
		action: 'services.list',
		target: null,
		result: 'denied',
		errorCode: 'EACCES',
		requestId: 'req-2',
		prevHash: 'aaaa',
		payloadHash: 'bbbb',
		payload: { ip: '10.0.0.5' },
		createdAt: '2026-06-03T12:00:00.000Z',
		...over,
	};
}

type DetailProps = ComponentProps<typeof AuditEventDetail>;

function renderDetail(over: Partial<DetailProps> = {}) {
	const defaults: DetailProps = {
		event: makeEvent(),
		prevId: null,
		nextId: null,
		chainLink: null,
		messages: testMessages,
	};
	return render(AuditEventDetail, { props: { ...defaults, ...over } });
}

describe('AuditEventDetail', () => {
	it('renders the event id and surface/action fields', () => {
		const { container } = renderDetail();
		expect(container.textContent).toContain('services');
		expect(container.textContent).toContain('services.list');
		expect(container.textContent).toContain('00000000-0000-4000-8000-000000000002');
	});

	it('hides sensitive fields (IP + user agent) by default', () => {
		const { container } = renderDetail();
		expect(container.querySelector('[data-testid="sensitive-fields"]')).toBeNull();
	});

	it('shows sensitive fields after clicking Show', async () => {
		const user = userEvent.setup();
		const { container } = renderDetail();
		const buttons = Array.from(container.querySelectorAll('button'));
		const showBtn = buttons.find((b) => b.textContent?.trim() === 'Show');
		expect(showBtn).toBeDefined();
		await user.click(showBtn!);
		expect(container.querySelector('[data-testid="sensitive-fields"]')).not.toBeNull();
	});

	it('hides sensitive fields again after clicking Hide', async () => {
		const user = userEvent.setup();
		const { container } = renderDetail();
		const buttons = Array.from(container.querySelectorAll('button'));
		const showBtn = buttons.find((b) => b.textContent?.trim() === 'Show');
		await user.click(showBtn!);
		const hideBtn = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent?.trim() === 'Hide',
		);
		expect(hideBtn).toBeDefined();
		await user.click(hideBtn!);
		expect(container.querySelector('[data-testid="sensitive-fields"]')).toBeNull();
	});

	it('renders a prev link when prevId is set', () => {
		const { container } = renderDetail({
			prevId: asAuditEventId('00000000-0000-4000-8000-000000000001'),
		});
		const prev = container.querySelector('[data-slot="audit-prev"]');
		expect(prev).not.toBeNull();
		expect(prev?.getAttribute('href')).toBe('/audit/00000000-0000-4000-8000-000000000001');
	});

	it('renders a next link when nextId is set', () => {
		const { container } = renderDetail({
			nextId: asAuditEventId('00000000-0000-4000-8000-000000000003'),
		});
		const next = container.querySelector('[data-slot="audit-next"]');
		expect(next).not.toBeNull();
		expect(next?.getAttribute('href')).toBe('/audit/00000000-0000-4000-8000-000000000003');
	});

	it('renders the chain-link badge with data-chain-ok=true on success', () => {
		const { container } = renderDetail({ chainLink: { ok: true, length: 7 } });
		const link = container.querySelector('[data-slot="audit-chain-link"]');
		expect(link).not.toBeNull();
		expect(link?.getAttribute('data-chain-ok')).toBe('true');
	});

	it('renders the chain-link badge with data-chain-ok=false on failure', () => {
		const { container } = renderDetail({
			chainLink: { ok: false, index: 3, reason: 'mismatch' },
		});
		const link = container.querySelector('[data-slot="audit-chain-link"]');
		expect(link).not.toBeNull();
		expect(link?.getAttribute('data-chain-ok')).toBe('false');
		expect(link?.textContent).toContain('mismatch');
	});

	it('renders the payload as a pre-formatted JSON block', () => {
		const { container } = renderDetail();
		const pre = container.querySelector('[data-slot="audit-payload"]');
		expect(pre).not.toBeNull();
		expect(pre?.textContent).toContain('"ip": "10.0.0.5"');
	});
});
