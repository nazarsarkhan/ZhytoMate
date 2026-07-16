import { expect, test } from '@playwright/test';

async function openAssistant(page, response) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/refresh')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'e2e-token', refreshToken: 'e2e-refresh', user: { firstName: 'E2E', lastName: 'Test', role: 'user' } }),
      });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { firstName: 'E2E', lastName: 'Test', role: 'user', address: {}, preferences: {} } }),
      });
    }
    if (url.pathname.endsWith('/assistant/query')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: '507f1f77bcf86cd799439011',
          confidence: response.confidence,
          grounded: response.grounded,
          verified: response.verified,
          answerStatus: response.answerStatus,
          answer: response.answer,
          sourcesUsed: response.sourcesUsed,
          app_links: response.appLinks || [],
        }),
      });
    }
    return route.continue();
  });
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('e2e@example.com');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('e2e-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.waitForURL('**/assistant');
  const input = page.getByRole('textbox', { name: 'Запитай асистента...' });
  await expect(input).toBeVisible();
  return input;
}

test('renders an OSM URL source as a clickable link', async ({ page }) => {
  const input = await openAssistant(page, {
    answer: 'Кафе найдено',
    sourcesUsed: ['https://www.openstreetmap.org/node/1'],
    grounded: true,
    verified: true,
    confidence: 0.9,
    answerStatus: 'grounded',
  });
  await input.fill('Куда пойти поесть?');
  await page.getByRole('button', { name: /Запитати AI/ }).last().click();
  await expect(page.getByText('Кафе найдено')).toBeVisible();
  await expect(page.locator('a[href="https://www.openstreetmap.org/node/1"]')).toHaveCount(1);
});

test('does not render source links for an ungrounded answer', async ({ page }) => {
  const input = await openAssistant(page, {
    answer: 'Інформації не знайдено',
    sourcesUsed: [],
    grounded: false,
    verified: false,
    confidence: 0,
    answerStatus: 'ungrounded',
  });
  await input.fill('Неизвестное место в Житомире');
  await page.getByRole('button', { name: /Запитати AI/ }).last().click();
  const answer = page.getByText('Інформації не знайдено');
  await expect(answer).toBeVisible();
  await expect(answer.locator('..').locator('a')).toHaveCount(0);
});

test('renders only safe internal app capability links', async ({ page }) => {
  const input = await openAssistant(page, {
    answer: 'Маршрути можна переглянути в застосунку.',
    sourcesUsed: [],
    appLinks: [
      { capability: 'transport', label: 'Транспорт', route: '/services/transport', reason: 'Маршрути' },
      { capability: 'admin', label: 'Адмінка', route: '/admin/users', reason: 'Ні' },
      { capability: 'external', label: 'Зовнішній сайт', route: 'https://example.com', reason: 'Ні' },
    ],
    grounded: true,
    verified: true,
    confidence: 0.9,
    answerStatus: 'grounded',
  });
  await input.fill('Де подивитися маршрути?');
  await page.getByRole('button', { name: /Запитати AI/ }).last().click();
  await expect(page.locator('a[href="/services/transport"]')).toHaveCount(1);
  await expect(page.locator('a[href="/admin/users"]')).toHaveCount(0);
  await expect(page.locator('a[href="https://example.com"]')).toHaveCount(0);
});
