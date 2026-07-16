import { expect, test } from '@playwright/test';

test.setTimeout(120_000);
const liveRagEnabled = !process.env.CI || process.env.RUN_LIVE_RAG === 'true';

test('routes origin-destination transport questions to the transport capability', async ({ page }) => {
  test.skip(!liveRagEnabled, 'requires OPENAI_API_KEY for live RAG integration');
  const username = `transportqa${Date.now()}`;
  await page.goto('/register');
  await page.getByLabel('Логін').fill(username);
  await page.getByLabel("Ім'я").fill('Transport');
  await page.getByLabel('Прізвище').fill('Audit');
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Пароль').fill('TransportAudit2026!');
  await page.getByRole('button', { name: 'Створити акаунт' }).click();
  await page.waitForURL('**/assistant', { timeout: 30_000 });

  const query = 'Мені треба з Глобала доїхати на Богунію, де подивить розклад транспорту?';
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/assistant/query') && response.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByRole('textbox', { name: 'Запитай асистента...' }).fill(query);
  await page.getByRole('button', { name: /Запитати AI/ }).last().click();
  const response = await responsePromise;
  const body = await response.json();
  console.log(`TRANSPORT_ORIGIN_RESPONSE ${JSON.stringify({ answer: body.answer, appLinks: body.appLinks, sourcesUsed: body.sourcesUsed, grounded: body.grounded })}`);

  expect(response.status()).toBe(200);
  expect(body.appLinks).toEqual(expect.arrayContaining([
    expect.objectContaining({ capability: 'transport', route: '/services/transport' }),
  ]));
  await expect(page.getByRole('link', { name: /Транспорт/ }).last()).toHaveAttribute('href', '/services/transport');
});
