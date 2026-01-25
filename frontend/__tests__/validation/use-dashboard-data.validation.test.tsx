import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDashboard: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock('@/lib/api') as { apiClient: { getDashboard: jest.Mock } };

describe('useDashboardData validation', () => {
  it('sanitizes unexpected shapes', async () => {
    apiClient.getDashboard.mockResolvedValueOnce({
      data: {
        ok: true,
        global: {
          daily_traffic_bytes: 'not-an-array',
          daily_conns: null,
        },
        meta: {
          days: 'nope',
        },
        users: 'bad',
      },
    });

    const { result } = renderHook(() => useDashboardData({ enabled: true }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data?.global?.daily_traffic_bytes).toEqual([]);
    expect(result.current.data?.global?.daily_conns).toEqual([]);
    expect(result.current.data?.meta?.days).toEqual([]);
    expect(result.current.data?.users).toEqual({});
  });
});

