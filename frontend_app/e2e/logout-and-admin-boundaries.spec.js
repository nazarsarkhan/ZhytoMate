import { test, expect } from '@playwright/test';

test('admin navigation leaves admin without logging out, account logout clears session', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'logout-token', refreshToken: 'logout-refresh', user: { firstName: 'Admin', role: 'admin' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'Admin', lastName: 'Test', role: 'admin', address: {}, preferences: {} } }) });
    }
    if (url.pathname.endsWith('/contacts/admin')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contacts: [] }) });
    if (url.pathname.endsWith('/surveys')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ surveys: [] }) });
    if (url.pathname.endsWith('/appeals')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ appeals: [] }) });
    if (url.pathname.endsWith('/places/admin')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('admin');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.goto('/admin/users');

  await page.getByRole('link', { name: 'До застосунку' }).click();
  await expect(page).toHaveURL(/\/assistant$/);
  expect(await page.evaluate(() => localStorage.getItem('zhytomate.accessToken'))).toBe('logout-token');

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Вийти з акаунту' }).click();
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('zhytomate.accessToken'))).toBeNull();
});
