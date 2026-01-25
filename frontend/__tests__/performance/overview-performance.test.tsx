import { renderHook, waitFor } from '@testing-library/react';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';

jest.mock('@/lib/api', () => ({
  apiClient: {
    getDashboard: jest.fn(),
  },
}));

const { apiClient } = jest.requireMock('@/lib/api') as { apiClient: { getDashboard: jest.Mock } };

describe('overview performance', () => {
  it('fetches dashboard once per hook mount', async () => {
    apiClient.getDashboard.mockResolvedValueOnce({ data: { ok: true } });

    renderHook(() => useDashboardData({ days: 14, enabled: true }));

    await waitFor(() => {
      expect(apiClient.getDashboard).toHaveBeenCalledTimes(1);
    });
  });
});

