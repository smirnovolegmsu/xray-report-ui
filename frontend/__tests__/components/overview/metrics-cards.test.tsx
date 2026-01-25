import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetricsCards } from '@/components/features/overview/metrics-cards';
import type { DashboardApiResponse } from '@/types';

jest.mock('@number-flow/react', () => ({
  __esModule: true,
  default: ({ value }: { value: number | string }) => <span>{value}</span>,
}));

jest.mock('@/lib/number-flow-config', () => ({
  defaultNumberFlowConfig: {},
}));

jest.mock('@/lib/store', () => ({
  useAppStore: () => ({ lang: 'en' }),
}));

describe('MetricsCards', () => {
  it('renders error state with retry', async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn().mockResolvedValue(undefined);

    render(<MetricsCards dashboard={null} loading={false} error="boom" onRetry={onRetry} />);

    expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders stats from dashboard', () => {
    const dashboard: DashboardApiResponse = {
      ok: true,
      global: {
        daily_traffic_bytes: [1000, 2000],
        prev_daily_traffic_bytes: [500, 500],
        daily_conns: [1, 2],
        prev_daily_conns: [1, 1],
      },
      users: {
        'a@example.com': { sum7_traffic_bytes: 1 },
        'b@example.com': { sum7_traffic_bytes: 0 },
      },
    };

    render(<MetricsCards dashboard={dashboard} loading={false} error={null} />);

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText(/active/)).toBeInTheDocument();
  });
});

