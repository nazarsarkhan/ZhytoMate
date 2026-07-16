import { expect, test } from '@playwright/test';

const userRoutes = [
  '/services',
  '/services/contacts',
  '/services/polls',
  '/services/appeals',
  '/services/transport',
  '/services/outages',
  '/places',
  '/news',
  '/notifications',
  '/profile',
  '/chat-history',
];

test('every allowlisted app capability route is reachable for a user', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'capability-token', refreshToken: 'capability-refresh', user: { firstName: 'E2E', role: 'user' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'E2E', lastName: 'User', role: 'user', address: {}, preferences: {} } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('capability-e2e');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('capability-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.waitForURL('**/assistant');

  for (const route of userRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replaceAll('/', '\\/')}$`));
  }
});
