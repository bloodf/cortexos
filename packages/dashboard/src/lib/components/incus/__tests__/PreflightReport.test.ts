/**
 * PreflightReport.test.ts — verify the read-only preflight
 * component renders checks (pass/fail), the banner, and the
 * empty state.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import PreflightReport from '../PreflightReport.svelte';
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';
import type { IncusPreflightReport } from '@cortexos/contracts';

const messages: Messages = en;

const OK_REPORT: IncusPreflightReport = {
  ok: true,
  checks: [
    { id: 'name', label: 'Instance name available', pass: true },
    { id: 'image', label: 'Base image present', pass: true },
    { id: 'pool', label: 'Storage pool present', pass: true },
    { id: 'bridge', label: 'Network bridge present', pass: true },
  ],
};

const FAIL_REPORT: IncusPreflightReport = {
  ok: false,
  checks: [
    { id: 'name', label: 'Instance name available', pass: true },
    { id: 'image', label: 'Base image present', pass: false, detail: 'no local image alias "missing/image"' },
  ],
};

describe('PreflightReport', () => {
  afterEach(cleanup);

  it('renders the ok banner when ok=true', () => {
    const { container } = render(PreflightReport, {
      props: { report: OK_REPORT, messages },
    });
    const banner = container.querySelector('[data-slot="preflight-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('data-ok')).toBe('true');
    expect(banner?.textContent).toContain('All checks passed');
  });

  it('renders the fail banner when ok=false', () => {
    const { container } = render(PreflightReport, {
      props: { report: FAIL_REPORT, messages },
    });
    const banner = container.querySelector('[data-slot="preflight-banner"]');
    expect(banner?.getAttribute('data-ok')).toBe('false');
    expect(banner?.textContent).toContain('failed');
  });

  it('renders one row per check', () => {
    const { container } = render(PreflightReport, {
      props: { report: OK_REPORT, messages },
    });
    const checks = container.querySelectorAll('[data-slot="preflight-check"]');
    expect(checks.length).toBe(OK_REPORT.checks.length);
  });

  it('flags pass=true / pass=false per check', () => {
    const { container } = render(PreflightReport, {
      props: { report: FAIL_REPORT, messages },
    });
    const checks = container.querySelectorAll('[data-slot="preflight-check"]');
    expect(checks[0]?.getAttribute('data-pass')).toBe('true');
    expect(checks[1]?.getAttribute('data-pass')).toBe('false');
  });

  it('renders the check detail when present', () => {
    const { container } = render(PreflightReport, {
      props: { report: FAIL_REPORT, messages },
    });
    const checks = container.querySelectorAll('[data-slot="preflight-check"]');
    expect(checks[1]?.textContent).toContain('no local image alias');
  });

  it('renders the empty state when no checks', () => {
    const { container } = render(PreflightReport, {
      props: { report: { ok: true, checks: [] }, messages },
    });
    const empty = container.querySelector('[data-slot="preflight-empty"]');
    expect(empty).not.toBeNull();
  });
});
