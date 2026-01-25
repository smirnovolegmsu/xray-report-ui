import { render, screen } from '@testing-library/react';
import { TrafficChart } from '@/components/features/overview/traffic-chart';
import type { DashboardApiResponse } from '@/types';

jest.mock('@nivo/bar', () => ({
  ResponsiveBar: () => <div data-testid="bar-chart" />,
}));

jest.mock('@/lib/store', () => ({
  useAppStore: () => ({ lang: 'en' }),
}));

describe('TrafficChart', () => {
  it('renders empty state', () => {
    const dashboard: DashboardApiResponse = { ok: true, global: {}, meta: { days: [] } };
    render(<TrafficChart dashboard={dashboard} loading={false} error={null} mode="daily" metric="traffic" />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders chart when data present', () => {
    const dashboard: DashboardApiResponse = {
      ok: true,
      meta: { days: ['2026-01-01'] },
      global: { daily_traffic_bytes: [1024 * 1024 * 1024], daily_conns: [10] },
    };
    render(<TrafficChart dashboard={dashboard} loading={false} error={null} mode="daily" metric="traffic" />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});

