import { test, expect } from '@playwright/test';

const accessTokenKey = 'zhytomate.accessToken';
const refreshTokenKey = 'zhytomate.refreshToken';

async function login(page, loginValue = 'admin', password = 'password') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email або логін' }).fill(loginValue);
  await page.getByRole('textbox', { name: 'Пароль' }).fill(password);
  await page.getByRole('button', { name: 'Увійти' }).click();
}

function createAuthRouteHandler() {
  let loginCount = 0;
  let currentRole = 'admin';
  let delayNextCurrentUserMs = 0;

  return {
    setCurrentRole(nextRole) {
      currentRole = nextRole;
    },
    delayNextCurrentUser(ms) {
      delayNextCurrentUserMs = ms;
    },
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());

      if (url.pathname.endsWith('/auth/login')) {
        loginCount += 1;
        currentRole = loginCount === 1 ? 'admin' : 'user';

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: `${currentRole}-access-token`,
            refreshToken: `${currentRole}-refresh-token`,
            user: { firstName: currentRole === 'admin' ? 'Admin' : 'Resident', role: currentRole },
          }),
        });
      }

      if (url.pathname.endsWith('/users/me')) {
        if (delayNextCurrentUserMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayNextCurrentUserMs));
          delayNextCurrentUserMs = 0;
        }

        const user =
          currentRole === 'admin'
            ? {
                firstName: 'Admin',
                lastName: 'Test',
                email: 'admin@example.com',
                role: 'admin',
                address: { city: 'Житомир', street: 'Майдан Соборний' },
                preferences: {},
              }
            : {
                firstName: 'Resident',
                lastName: 'Test',
                email: 'resident@example.com',
                role: 'user',
                address: { city: 'Житомир', street: 'Київська' },
                preferences: {},
              };

        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user }),
        });
      }

      if (url.pathname.endsWith('/contacts/admin')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ contacts: [] }) });
      }

      if (url.pathname.endsWith('/surveys')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ surveys: [] }) });
      }

      if (url.pathname.endsWith('/appeals')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ appeals: [] }) });
      }

      if (url.pathname.endsWith('/places/admin')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ places: [] }) });
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    },
  };
}

test('profile logout clears both tokens and protects the previous page from browser back', async ({ page }) => {
  const authRoutes = createAuthRouteHandler();
  await page.route('**/api/**', (route) => authRoutes.handle(route));

  await login(page);
  await page.goto('/profile');

  await page.locator('main').getByRole('button', { name: /Вийти/ }).click();
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), accessTokenKey)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), refreshTokenKey)).toBeNull();

  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
});

test('admin navigation returns to the app without logging out', async ({ page }) => {
  const authRoutes = createAuthRouteHandler();
  await page.route('**/api/**', (route) => authRoutes.handle(route));

  await login(page);
  await page.goto('/admin/users');

  await expect(page.getByRole('link', { name: 'До застосунку' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Вийти з акаунту' })).toBeVisible();

  await page.getByRole('link', { name: 'До застосунку' }).click();

  await expect(page).toHaveURL(/\/assistant$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), accessTokenKey)).toBe('admin-access-token');
  expect(await page.evaluate((key) => localStorage.getItem(key), refreshTokenKey)).toBe('admin-refresh-token');
});

test('admin account logout clears both tokens, clears stale admin cache, and protects browser back', async ({ page }) => {
  const authRoutes = createAuthRouteHandler();
  await page.route('**/api/**', (route) => authRoutes.handle(route));

  await login(page);
  await page.goto('/assistant');
  await expect(page.getByRole('link', { name: 'Адмін' })).toBeVisible();

  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Вийти з акаунту' }).click();
  await page.getByRole('button', { name: 'Вийти', exact: true }).click();

  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), accessTokenKey)).toBeNull();
  expect(await page.evaluate((key) => localStorage.getItem(key), refreshTokenKey)).toBeNull();

  authRoutes.setCurrentRole('user');
  authRoutes.delayNextCurrentUser(1500);

  await login(page, 'resident', 'password');
  await expect(page).toHaveURL(/\/assistant$/);
  await expect(page.getByRole('link', { name: 'Адмін' })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/assistant$/);
});
