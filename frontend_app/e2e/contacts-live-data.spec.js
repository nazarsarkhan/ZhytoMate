import { test, expect } from '@playwright/test';

test('contacts page renders API-managed contacts and hotline without hardcoded fallback', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'contacts-token', refreshToken: 'contacts-refresh', user: { firstName: 'User', role: 'user' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'User', lastName: 'Test', role: 'user', address: {}, preferences: {} } }) });
    }
    if (url.pathname.endsWith('/contacts')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ emergency: [{ id: 'e1', name: 'Міська варта', phone: '999', icon: 'security' }], groups: [] }) });
    }
    if (url.pathname.endsWith('/settings/public')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { cityHotline: '15-88' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('user');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.goto('/services/contacts');

  await expect(page.getByText('Міська варта')).toBeVisible();
  await expect(page.getByText('999')).toBeVisible();
  await expect(page.getByText('15-88')).toBeVisible();
  await expect(page.getByText('Пожежна')).toHaveCount(0);
  await expect(page.getByText('15-80')).toHaveCount(0);
});
