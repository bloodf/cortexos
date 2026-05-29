import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AlertHistory } from '../alert-history';

const mockHistory = [
  { id: 1, rule_id: 2, service_id: 3, status: 'offline', message: 'Service down', created_at: '2024-01-01T00:00:00Z' },
  { id: 2, rule_id: 2, service_id: 3, status: 'online', message: 'Service up', created_at: '2024-01-01T01:00:00Z' },
];

describe('AlertHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton initially', () => {
    render(<AlertHistory limit={10} />);
    expect(screen.getByText('Alert History')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders history items after fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ history: mockHistory }),
    });

    render(<AlertHistory limit={10} />);

    await waitFor(() => {
      expect(screen.getByText('Service down')).toBeInTheDocument();
      expect(screen.getByText('Service up')).toBeInTheDocument();
    });
  });

  it('renders empty state when no history', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ history: [] }),
    });

    render(<AlertHistory limit={10} />);

    await waitFor(() => {
      expect(screen.getByText('No alerts yet')).toBeInTheDocument();
    });
  });
});
