import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { AlertHistory } from '../alert-history';

const mockHistory = [
  { id: 1, rule_id: 2, service_id: 3, status: 'offline', message: 'Service down', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, rule_id: 2, service_id: 3, status: 'online', message: 'Service up', created_at: '2024-01-01T01:00:00Z' },
];

// Each test gets a fresh SWR cache + `dedupingInterval: 0` so the
// module-level SWR cache (default dedupingInterval 2000 ms) does not bleed
// between tests in this file. Without this the second test's first
// `fetch` call is suppressed because SWR thinks the previous test's
// in-flight request is still pending.
const renderIsolated = (ui: React.ReactNode) =>
  render(
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
      {ui}
    </SWRConfig>
  );

describe('AlertHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton initially', () => {
    renderIsolated(<AlertHistory limit={10} />);
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders history items after fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ history: mockHistory }),
    });

    renderIsolated(<AlertHistory limit={10} />);

    await waitFor(() => {
      expect(screen.getByText('Service down')).toBeInTheDocument();
      expect(screen.getByText('Service up')).toBeInTheDocument();
    });
  });

  it('renders empty state when no history', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ history: [] }),
    });

    renderIsolated(<AlertHistory limit={10} />);

    await waitFor(() => {
      expect(screen.getByText('No alerts yet')).toBeInTheDocument();
    });
  });
});
