import { test, expect } from '@playwright/test';

async function login(page, username = 'admin', password = 'password') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /Email/i }).fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /Увійти/i }).click();
}

function createAdminApiHarness() {
  const userPatchBodies = [];
  const newsPatchBodies = [];
  const deletedNewsIds = [];

  const state = {
    users: [
      {
        id: 'usr-live-1',
        username: 'live.user',
        firstName: 'Live',
        lastName: 'User',
        email: 'live.user@example.com',
        phone: '+380 50 111 22 33',
        role: 'user',
        isActive: true,
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
    ],
    news: [
      {
        id: 'news-live-1',
        externalId: 'parser_news_live_1',
        title: 'Live news entry',
        summary: 'Regular city news from the API.',
        body: 'Regular city news body from the API.',
        source: 'city-feed',
        sourceUrl: 'https://example.com/news/live-1',
        category: 'city',
        importance: 3,
        importanceLabel: 'normal',
        isAnnouncement: false,
        publishedAt: '2026-07-10T09:00:00.000Z',
        expiresAt: null,
        tags: ['city'],
        lang: 'uk',
        createdAt: '2026-07-10T09:00:00.000Z',
        updatedAt: '2026-07-10T09:00:00.000Z',
      },
      {
        id: 'news-live-2',
        externalId: 'parser_news_live_2',
        title: 'Live announcement entry',
        summary: 'Important announcement from the API.',
        body: 'Important announcement body from the API.',
        source: 'city-feed',
        sourceUrl: 'https://example.com/news/live-2',
        category: 'alerts',
        importance: 5,
        importanceLabel: 'critical',
        isAnnouncement: true,
        publishedAt: '2026-07-11T09:00:00.000Z',
        expiresAt: null,
        tags: ['alert'],
        lang: 'uk',
        createdAt: '2026-07-11T09:00:00.000Z',
        updatedAt: '2026-07-11T09:00:00.000Z',
      },
    ],
    settings: { cityHotline: '15-80' },
  };

  return {
    userPatchBodies,
    newsPatchBodies,
    deletedNewsIds,
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const { pathname, searchParams } = url;

      if (pathname.endsWith('/auth/login')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'admin-sections-access',
            refreshToken: 'admin-sections-refresh',
            user: { firstName: 'Admin', role: 'admin' },
          }),
        });
      }

      if (pathname.endsWith('/users/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              firstName: 'Admin',
              lastName: 'Sections',
              email: 'admin@example.com',
              role: 'admin',
              address: {},
              preferences: {},
            },
          }),
        });
      }

      if (pathname.endsWith('/users/admin') && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: state.users }),
        });
      }

      if (pathname.includes('/users/admin/') && request.method() === 'PATCH') {
        const id = pathname.split('/').pop();
        const updates = request.postDataJSON();
        userPatchBodies.push(updates);
        state.users = state.users.map((user) => (user.id === id ? { ...user, ...updates } : user));
        const user = state.users.find((entry) => entry.id === id);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ user }),
        });
      }

      if (pathname.endsWith('/news/admin') && request.method() === 'GET') {
        const wantsAnnouncements = searchParams.get('isAnnouncement');
        const isAnnouncement =
          wantsAnnouncements === null ? null : wantsAnnouncements === 'true';
        const news = state.news.filter((item) =>
          isAnnouncement === null ? true : item.isAnnouncement === isAnnouncement,
        );
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ news }),
        });
      }

      if (pathname.includes('/news/admin/') && request.method() === 'PATCH') {
        const id = pathname.split('/').pop();
        const updates = request.postDataJSON();
        newsPatchBodies.push(updates);
        state.news = state.news.map((item) => (item.id === id ? { ...item, ...updates } : item));
        const news = state.news.find((entry) => entry.id === id);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ news }),
        });
      }

      if (pathname.includes('/news/admin/') && request.method() === 'DELETE') {
        const id = pathname.split('/').pop();
        deletedNewsIds.push(id);
        state.news = state.news.filter((item) => item.id !== id);
        return route.fulfill({ status: 204, body: '' });
      }

      if (pathname.endsWith('/settings/admin')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ settings: state.settings }),
        });
      }

      if (pathname.endsWith('/settings/public')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ settings: state.settings }),
        });
      }

      if (pathname.endsWith('/surveys')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ surveys: [] }),
        });
      }

      if (pathname.endsWith('/appeals')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ appeals: [] }),
        });
      }

      if (pathname.endsWith('/contacts/admin')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ contacts: [] }),
        });
      }

      if (pathname.endsWith('/contacts')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ emergency: [], groups: [] }),
        });
      }

      if (pathname.endsWith('/places/admin')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ places: [] }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    },
  };
}

test('admin users, news, and announcements render live API data and persist live mutations', async ({
  page,
}) => {
  const api = createAdminApiHarness();
  await page.route('**/api/**', (route) => api.handle(route));

  await login(page);

  await page.goto('/admin/users');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByText('Live User')).toBeVisible();

  await page.getByRole('link', { name: /Live User/ }).click();
  await page.getByRole('button', { name: /Редагувати/i }).click();
  await page.getByLabel('Телефон').fill('+380 50 000 00 01');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();

  await expect
    .poll(() => api.userPatchBodies.at(-1)?.phone ?? null)
    .toBe('+380 50 000 00 01');
  await expect(page.getByText('+380 50 000 00 01')).toBeVisible();

  await page.goto('/admin/news');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByText('Live news entry')).toBeVisible();
  await expect(page.getByText('Live announcement entry')).toHaveCount(0);

  await page.goto('/admin/announcements');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByText('Live announcement entry')).toBeVisible();
  await expect(page.getByText('Live news entry')).toHaveCount(0);

  await page.getByRole('link', { name: /Live announcement entry/ }).click();
  await page.getByRole('button', { name: /Видалити/i }).click();
  await page.getByRole('button', { name: 'Видалити', exact: true }).click();

  await expect.poll(() => api.deletedNewsIds).toEqual(['news-live-2']);
  await expect(page).toHaveURL(/\/admin\/announcements$/);
  await expect(page.getByText('Live announcement entry')).toHaveCount(0);
});

test('admin sections surface explicit backend errors instead of prototype data', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'admin-error-access',
          refreshToken: 'admin-error-refresh',
          user: { firstName: 'Admin', role: 'admin' },
        }),
      });
    }

    if (pathname.endsWith('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            firstName: 'Admin',
            lastName: 'Errors',
            email: 'admin@example.com',
            role: 'admin',
            address: {},
            preferences: {},
          },
        }),
      });
    }

    if (pathname.endsWith('/users/admin')) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Users admin unavailable' }),
      });
    }

    if (pathname.endsWith('/news/admin')) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'News admin unavailable' }),
      });
    }

    if (pathname.endsWith('/surveys')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ surveys: [] }),
      });
    }

    if (pathname.endsWith('/appeals')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ appeals: [] }),
      });
    }

    if (pathname.endsWith('/contacts/admin')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ contacts: [] }),
      });
    }

    if (pathname.endsWith('/places/admin')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ places: [] }),
      });
    }

    if (pathname.endsWith('/settings/admin')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: { cityHotline: '' } }),
      });
    }

    if (pathname.endsWith('/settings/public')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: { cityHotline: '' } }),
      });
    }

    if (pathname.endsWith('/contacts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ emergency: [], groups: [] }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await login(page);

  await page.goto('/admin/users');
  await expect(page.getByText('Users admin unavailable')).toBeVisible();

  await page.goto('/admin/news');
  await expect(page.getByText('News admin unavailable')).toBeVisible();
});
