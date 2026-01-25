import { render, screen } from '@testing-library/react';
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

describe('Overview edge cases', () => {
  it('does not show % badge when previous period is 0', () => {
    const dashboard: DashboardApiResponse = {
      ok: true,
      global: {
        daily_traffic_bytes: [100],
        prev_daily_traffic_bytes: [0],
        daily_conns: [1],
        prev_daily_conns: [0],
      },
      users: {},
    };

    render(<MetricsCards dashboard={dashboard} loading={false} error={null} />);

    // There should be no percentage badge because calculateChange() returns null when previous == 0
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

