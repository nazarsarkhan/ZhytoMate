import { test, expect } from '@playwright/test';

const adminSections = ['users', 'surveys', 'announcements', 'news', 'appeals', 'contacts', 'places'];
const sectionLabels = {
  users: 'Юзери',
  surveys: 'Опитування',
  announcements: 'Анонси',
  news: 'Новини',
  appeals: 'Звернення',
  contacts: 'Контакти',
  places: 'Місця',
};

test('admin sections render an authenticated page or explicit empty state', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'admin-e2e-token', refreshToken: 'admin-e2e-refresh', user: { firstName: 'Admin', role: 'admin' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'Admin', lastName: 'E2E', role: 'admin', address: {}, preferences: {} } }) });
    }
    if (url.pathname.endsWith('/surveys')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
    if (url.pathname.endsWith('/appeals')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
    if (url.pathname.endsWith('/contacts/admin')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
    if (url.pathname.endsWith('/places/admin')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
    return route.continue();
  });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('adminqa_20260716');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('AdminQA2026!');
  await page.getByRole('button', { name: 'Увійти' }).click();

  for (const section of adminSections) {
    await page.goto(`/admin/${section}`);
    await expect(page).toHaveURL(new RegExp(`/admin/${section}$`));
    await expect(page.getByRole('heading', { name: sectionLabels[section] })).toBeVisible();
    await expect(page.getByText('Нічого не знайдено').or(page.getByRole('article').first())).toBeVisible();
  }
  expect(pageErrors).toEqual([]);
});
