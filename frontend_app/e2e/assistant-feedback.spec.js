import { expect, test } from '@playwright/test';

test('lets a resident rate an assistant answer and change the vote', async ({ page }) => {
  const feedbackRequests = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/auth/login') || url.pathname.endsWith('/auth/refresh')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ accessToken: 'e2e-token', refreshToken: 'e2e-refresh', user: { firstName: 'E2E', lastName: 'Test', role: 'user' } }) });
    }
    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { firstName: 'E2E', lastName: 'Test', role: 'user', address: {}, preferences: {} } }) });
    }
    if (url.pathname.endsWith('/assistant/query')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId: '507f1f77bcf86cd799439011',
          messageId: '507f1f77bcf86cd799439012',
          answer: 'Ось перевірена відповідь.',
          sourcesUsed: ['https://example.com/source'],
          grounded: true,
          verified: true,
          answerStatus: 'grounded',
          appLinks: [],
        }),
      });
    }
    if (url.pathname.endsWith('/assistant/feedback')) {
      const body = request.postDataJSON();
      feedbackRequests.push(body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ feedback: { messageId: body.messageId, vote: body.vote, reason: body.reason || null } }) });
    }
    return route.continue();
  });

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill('e2e@example.com');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('e2e-password');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.waitForURL('**/assistant');

  const input = page.getByRole('textbox', { name: 'Запитай асистента...' });
  await input.fill('Де ЦНАП?');
  await page.getByRole('button', { name: /Запитати AI/ }).last().click();
  await expect(page.getByText('Ось перевірена відповідь.')).toBeVisible();

  await page.getByRole('button', { name: 'Оцінити відповідь негативно' }).click();
  await page.getByRole('button', { name: 'Не вистачає інформації' }).click();
  await expect.poll(() => feedbackRequests.length).toBe(1);
  expect(feedbackRequests[0]).toMatchObject({ vote: 'down', reason: 'missing_information', messageId: '507f1f77bcf86cd799439012' });

  await page.getByRole('button', { name: 'Оцінити відповідь позитивно' }).click();
  await expect.poll(() => feedbackRequests.length).toBe(2);
  expect(feedbackRequests[1]).toMatchObject({ vote: 'up', messageId: '507f1f77bcf86cd799439012' });
  expect(feedbackRequests[1].reason).toBe(null);
  await expect(page.getByRole('button', { name: 'Оцінити відповідь позитивно' })).toHaveAttribute('aria-pressed', 'true');
});
