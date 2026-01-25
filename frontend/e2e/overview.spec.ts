import { test, expect } from '@playwright/test';

test('overview loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

