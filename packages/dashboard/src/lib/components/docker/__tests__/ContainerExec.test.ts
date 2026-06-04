/**
 * ContainerExec.test.ts — verifies the exec form renders the
 * allowlist, carries the approval token, and surfaces server
 * errors / output.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ContainerExec from '../ContainerExec.svelte';
import { FROZEN_NOW } from '../../../mocks/fixtures/seed';
import { adaptContainer } from '../adapter';
import { testMessages } from './messages';

const fixture = adaptContainer({
  id: 'sha256:abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
  name: 'grafana-1',
  image: 'grafana/grafana:11.2.0',
  state: 'running',
  status: 'Up 2 hours',
  ports: ['3000:3000'],
  created: FROZEN_NOW,
  privileged: false,
  networks: ['monitoring'],
  mounts: [],
});

const ALLOWED = [
  { value: 'ls -la', label: 'ls -la' },
  { value: 'ps auxf', label: 'ps auxf' },
  { value: 'uptime', label: 'uptime' },
];

describe('ContainerExec', () => {
  afterEach(cleanup);

  it('renders the form, the allowlist, and the hidden approval token', () => {
    const { container } = render(ContainerExec, {
      props: {
        container: fixture,
        messages: testMessages,
        approvalToken: 'tok-abc-123',
        allowedSubcommands: ALLOWED,
      },
    });
    const form = container.querySelector('[data-slot="container-exec-form"]');
    expect(form).not.toBeNull();
    const hidden = form?.querySelector('input[name="approvalToken"]') as HTMLInputElement;
    expect(hidden?.value).toBe('tok-abc-123');
    const select = container.querySelector('[data-slot="container-exec-subcommand"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(ALLOWED.length);
  });

  it('renders the submit button', () => {
    const { container } = render(ContainerExec, {
      props: {
        container: fixture,
        messages: testMessages,
        approvalToken: 'tok',
        allowedSubcommands: ALLOWED,
      },
    });
    const submit = container.querySelector(
      '[data-slot="container-exec-submit"]',
    ) as HTMLButtonElement;
    expect(submit).not.toBeNull();
    expect(submit.type).toBe('submit');
  });

  it('shows the error banner when error is set', () => {
    const { container } = render(ContainerExec, {
      props: {
        container: fixture,
        messages: testMessages,
        approvalToken: 'tok',
        allowedSubcommands: ALLOWED,
        error: 'Approval token rejected: expired',
      },
    });
    const err = container.querySelector('[data-slot="container-exec-error"]');
    expect(err?.textContent).toContain('Approval token rejected');
  });

  it('shows the output block when output is set', () => {
    const { container } = render(ContainerExec, {
      props: {
        container: fixture,
        messages: testMessages,
        approvalToken: 'tok',
        allowedSubcommands: ALLOWED,
        output: 'Linux 6.1.0',
      },
    });
    const out = container.querySelector('[data-slot="container-exec-output"]');
    expect(out?.textContent).toContain('Linux 6.1.0');
  });

  it('disables the submit button when submitting=true', () => {
    const { container } = render(ContainerExec, {
      props: {
        container: fixture,
        messages: testMessages,
        approvalToken: 'tok',
        allowedSubcommands: ALLOWED,
        submitting: true,
      },
    });
    const submit = container.querySelector(
      '[data-slot="container-exec-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});
