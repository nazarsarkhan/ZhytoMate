import { expect, test } from '@playwright/test';

async function login(page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'e2e-token', refreshToken: 'e2e-refresh', user: { firstName: 'E2E' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'E2E', lastName: 'Test', role: 'user' } }) });
    }
    if (url.pathname.endsWith('/places')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ sourceId: 'osm:node:1', name: 'Кафе Житомир', address: 'Михайлівська, 3', latitude: 50.25, longitude: 28.66, sourceUrl: 'https://www.openstreetmap.org/node/1', catalogUpdatedAt: new Date().toISOString() }], total: 1, catalogUpdatedAt: new Date().toISOString() }) });
    }
    return route.continue();
  });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('e2e@example.com');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('e2e-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.waitForURL('**/assistant');
}

test('services cards and places catalog render without title-key regressions', async ({ page }) => {
  await login(page);
  await page.goto('/services');
  await expect(page.getByText('Контакти')).toBeVisible();
  await expect(page.getByText('Місця міста')).toBeVisible();
  await page.getByRole('link', { name: /Місця міста/ }).click();
  await expect(page.getByRole('heading', { name: 'Місця Житомира' })).toBeVisible();
  await expect(page.getByText('Кафе Житомир')).toBeVisible();
  await expect(page.locator('a[href="https://www.openstreetmap.org/node/1"]')).toHaveCount(1);
});
