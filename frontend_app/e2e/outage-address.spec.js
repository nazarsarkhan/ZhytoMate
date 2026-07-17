import { test, expect } from '@playwright/test';

test('renders the outage schedule for an address resolved through a street-level queue fallback', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            firstName: 'E2E',
            lastName: 'Test',
            address: {
              street: 'вулиця Кибальчича',
              building: '3',
              district: 'Житомирський район',
              city: 'Житомир',
              formatted: '3, вулиця Кибальчича, Житомирський район, Житомир',
              verified: true,
            },
            preferences: {},
          },
        }),
      });
    }

    if (url.pathname.endsWith('/outages/schedule')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          needsAddress: false,
          unavailable: false,
          schedule: {
            queue: '4.1',
            addressLabel: '3, вулиця Кибальчича',
            updatedAt: new Date().toISOString(),
            stale: false,
            now: { status: 'on', nextStatus: 'off', nextChangeInMinutes: 30, until: '12:00' },
            days: [{ date: '2026-07-17', label: 'today', slots: [] }],
          },
        }),
      });
    }

    return route.continue();
  });

  await page.goto('/services/outages');

  await expect(page.getByRole('heading', { name: 'Графік відключень' })).toBeVisible();
  await expect(page.getByText('Черга 4.1')).toBeVisible();
  await expect(page.getByText('3, вулиця Кибальчича')).toBeVisible();
  await expect(page.getByText('Планових відключень немає')).toBeVisible();
});
