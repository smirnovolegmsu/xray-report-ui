import { render, screen } from '@testing-library/react';
import { TopDomains } from '@/components/features/overview/top-domains';
import type { DashboardApiResponse } from '@/types';

jest.mock('@/lib/store', () => ({
  useAppStore: () => ({ lang: 'en' }),
}));

describe('TopDomains', () => {
  it('renders empty state', () => {
    const dashboard: DashboardApiResponse = { ok: true, global: { top_domains_traffic: [], top_domains_conns: [] } };
    render(<TopDomains dashboard={dashboard} loading={false} error={null} />);
    expect(screen.getByText('Top Domains (7 days)')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders list', () => {
    const dashboard: DashboardApiResponse = {
      ok: true,
      global: {
        top_domains_traffic: [{ domain: 'example.com', value: 1024 }],
        top_domains_conns: [{ domain: 'example.com', value: 7 }],
      },
    };
    render(<TopDomains dashboard={dashboard} loading={false} error={null} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });
});

