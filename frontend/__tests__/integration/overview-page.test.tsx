import { render, screen } from '@testing-library/react';
import OverviewPage from '@/app/page';

jest.mock('@nivo/bar', () => ({
  ResponsiveBar: () => <div data-testid="bar-chart" />,
}));

jest.mock('@nivo/line', () => ({
  ResponsiveLine: () => <div data-testid="line-chart" />,
}));

jest.mock('@number-flow/react', () => ({
  __esModule: true,
  default: ({ value }: { value: number | string }) => <span>{value}</span>,
}));

jest.mock('@/lib/number-flow-config', () => ({
  defaultNumberFlowConfig: {},
}));

jest.mock('@/components/layout/main-layout', () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/lib/store', () => ({
  useAppStore: () => ({ lang: 'en' }),
}));

jest.mock('@/lib/hooks/use-dashboard-data', () => ({
  useDashboardData: () => ({
    data: {
      ok: true,
      kpi: { today_bytes: 0, yesterday_bytes: 0, change_pct: null, total_users: 2, active_users: 1 },
      collector: { enabled: true, lag_days: 0 },
      meta: { days: ['2026-01-01'] },
      global: {
        daily_traffic_bytes: [0],
        prev_daily_traffic_bytes: [0],
        daily_conns: [0],
        prev_daily_conns: [0],
        top_domains_traffic: [],
        top_domains_conns: [],
      },
      users: {
        'a@example.com': { sum7_traffic_bytes: 1 },
        'b@example.com': { sum7_traffic_bytes: 0 },
      },
    },
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('OverviewPage integration', () => {
  it('renders overview dashboard sections', () => {
    render(<OverviewPage />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('System overview and metrics')).toBeInTheDocument();
    expect(screen.getByText('Top Domains (7 days)')).toBeInTheDocument();
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});

