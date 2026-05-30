import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { AlertToastListener } from '../alert-toast';
import { useSocket } from '@/hooks/use-socket';

vi.mock('@/hooks/use-socket', () => ({
  useSocket: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

describe('AlertToastListener', () => {
  const subscribe = vi.fn();
  const unsubscribe = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useSocket as any).mockReturnValue({ subscribe, unsubscribe });
  });

  it('subscribes to alert:triggered on mount', () => {
    render(<AlertToastListener />);
    expect(subscribe).toHaveBeenCalledWith('alert:triggered', expect.any(Function));
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = render(<AlertToastListener />);
    unmount();
    expect(unsubscribe).toHaveBeenCalledWith('alert:triggered', expect.any(Function));
  });

  it('calls toast when alert:triggered fires', async () => {
    let handler: (...args: unknown[]) => void = () => {};
    subscribe.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'alert:triggered') handler = cb;
    });

    render(<AlertToastListener />);

    handler({
      ruleId: 1,
      ruleName: 'Test',
      serviceId: 2,
      serviceName: 'Svc',
      status: 'offline',
      message: 'Svc is offline',
      timestamp: Date.now(),
    });

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith('Svc is offline', expect.objectContaining({ duration: 8000 }));
    });
  });
});
