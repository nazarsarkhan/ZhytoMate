import { expect, test } from '@playwright/test';

const queries = [
  { kind: 'app', query: 'Де подивитися маршрути та тролейбуси?' },
  { kind: 'app', query: 'Де контакти міських служб?' },
  { kind: 'action', query: 'Хочу подати звернення про яму на дорозі' },
  { kind: 'app', query: 'Де міські опитування?' },
  { kind: 'app', query: 'Де подивитися графік відключень?' },
  { kind: 'app', query: 'Покажи мої сповіщення' },
  { kind: 'app', query: 'Відкрити мій профіль' },
  { kind: 'app', query: 'Покажи історію чатів' },
  { kind: 'app', query: 'Де міські сервіси?' },
  { kind: 'places', query: 'Куда пойти поесть в Житомире?' },
  { kind: 'places', query: 'Де знайти кафе в центрі?' },
  { kind: 'news', query: 'Останні новини Житомира' },
  { kind: 'civic', query: 'Хто мер Житомира?' },
  { kind: 'civic', query: 'Кто сейчас мэр Житомира?' },
  { kind: 'government', query: 'Де ЦНАП у Житомирі?' },
  { kind: 'government', query: 'Где сделать паспорт в Житомире?' },
  { kind: 'government', query: 'А где суд?' },
  { kind: 'transport', query: 'Який маршрут тролейбуса №15А?' },
  { kind: 'transport', query: 'Як доїхати до вокзалу?' },
  { kind: 'transport', query: 'Мені треба з Глобала доїхати на Богунію, де подивить розклад транспорту?' },
  { kind: 'shopping', query: 'Де купити воду в центрі?' },
  { kind: 'shopping', query: 'Какие супермаркеты есть в Житомире?' },
  { kind: 'health', query: 'Де найближча аптека?' },
  { kind: 'health', query: 'Где детская больница в Житомире?' },
  { kind: 'food', query: 'Де поїсти недорого?' },
  { kind: 'culture', query: 'Які музеї є в Житомирі?' },
  { kind: 'education', query: 'Де дитячий садок?' },
  { kind: 'utilities', query: 'Коли вивозять сміття?' },
  { kind: 'utilities', query: 'Куда звонить если нет воды?' },
  { kind: 'news', query: 'Що нового в Житомирі сьогодні?' },
  { kind: 'general', query: 'Привіт, що ти вмієш?' },
  { kind: 'general', query: 'Яка столиця Франції?' },
  { kind: 'unknown', query: 'Який найкращий ресторан на Марсі?' },
  { kind: 'live', query: 'Яка погода сьогодні в Житомирі?' },
];

test.setTimeout(15 * 60 * 1000);
const liveRagEnabled = !process.env.CI || process.env.RUN_LIVE_RAG === 'true';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('live RAG understands app capabilities and civic queries through the UI', async ({ page }) => {
  test.skip(!liveRagEnabled, 'requires OPENAI_API_KEY for live RAG integration');
  const username = `ragqa${Date.now()}`;
  const email = `${username}@example.com`;
  const password = 'RagAudit2026!';
  const rows = [];
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/register');
  await page.getByLabel('Логін').fill(username);
  await page.getByLabel("Ім'я").fill('RAG');
  await page.getByLabel('Прізвище').fill('Audit');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Створити акаунт' }).click();
  await page.waitForURL('**/assistant', { timeout: 30_000 });

  const input = page.getByRole('textbox', { name: 'Запитай асистента...' });
  for (const [index, item] of queries.entries()) {
    const started = Date.now();
    let response;
    let body;
    let error = '';
    try {
      const responsePromise = page.waitForResponse(
        (candidate) => candidate.url().includes('/api/assistant/query') && candidate.request().method() === 'POST',
        { timeout: 45_000 },
      );
      await input.fill(item.query);
      await page.getByRole('button', { name: /Запитати AI/ }).last().click();
      response = await responsePromise;
      body = await response.json();
      await expect(page.getByRole('button', { name: /Запитати AI/ }).last()).toBeEnabled({ timeout: 45_000 });
      await expect(page.getByText(item.query, { exact: true }).last()).toBeVisible({ timeout: 5_000 });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }

    const appLinks = Array.isArray(body?.appLinks) ? body.appLinks : [];
    const sources = Array.isArray(body?.sourcesUsed) ? body.sourcesUsed : [];
    const invalidLinks = appLinks.filter((link) => !/^\/(?!admin(?:\/|$))[^:]*$/.test(link.route || ''));
    const unexpectedAppLinks = ['general', 'unknown', 'live'].includes(item.kind) && appLinks.length > 0;
    const missingExpectedLink = ['app', 'places', 'news', 'transport'].includes(item.kind) && appLinks.length === 0;
    const invariantFailure = body && (!body.grounded && sources.length > 0 || body.verified && !body.grounded);
    const status = error || invalidLinks.length || unexpectedAppLinks || missingExpectedLink || invariantFailure ? 'FAIL' : 'OK';

    rows.push({
      index: index + 1,
      status: error ? 'FAIL' : status,
      kind: item.kind,
      query: item.query,
      answerStatus: body?.answerStatus || 'HTTP/error',
      httpStatus: response?.status(),
      grounded: body?.grounded,
      verified: body?.verified,
      sources: sources.length,
      appLinks: appLinks.map((link) => link.route),
      ms: Date.now() - started,
      error: error || undefined,
    });
    console.log(`RAG_AUDIT ${JSON.stringify(rows.at(-1), null, 0)}`);
  }

  await test.info().attach('rag-live-audit.json', {
    body: JSON.stringify(rows, null, 2),
    contentType: 'application/json',
  });
  console.log(`RAG_AUDIT_SUMMARY ${JSON.stringify({ total: rows.length, failures: rows.filter((row) => row.status === 'FAIL').length, pageErrors })}`);
  expect(pageErrors).toEqual([]);
  expect(rows.filter((row) => row.status === 'FAIL')).toEqual([]);
});
