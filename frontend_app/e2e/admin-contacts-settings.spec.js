import { test, expect } from '@playwright/test';

async function login(page, username = 'admin', password = 'password') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /Email/i }).fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /Увійти/i }).click();
}

function groupContacts(contacts) {
  const active = contacts
    .filter((contact) => contact.isActive !== false)
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind.localeCompare(right.kind);
      if ((left.group || '') !== (right.group || '')) {
        return (left.group || '').localeCompare(right.group || '');
      }
      if ((left.order ?? 0) !== (right.order ?? 0)) return (left.order ?? 0) - (right.order ?? 0);
      return left.name.localeCompare(right.name);
    });

  const emergency = active.filter((contact) => contact.kind === 'emergency');
  const utilityGroups = new Map();

  for (const contact of active.filter((entry) => entry.kind === 'utility')) {
    const key = contact.group || 'Інші контакти';
    const items = utilityGroups.get(key) || [];
    items.push(contact);
    utilityGroups.set(key, items);
  }

  return {
    emergency,
    groups: [...utilityGroups.entries()].map(([group, items]) => ({ group, items })),
  };
}

function createContactsAndSettingsHarness() {
  const contactPatchBodies = [];
  const settingsPatchBodies = [];

  const state = {
    contacts: [
      {
        id: 'contact-emergency-1',
        name: 'Emergency Line',
        phone: '101-custom',
        icon: 'shield',
        kind: 'emergency',
        group: '',
        order: 99,
        isActive: false,
      },
      {
        id: 'contact-utility-1',
        name: 'Water Utility',
        phone: '0412 24-08-10',
        icon: 'water_drop',
        kind: 'utility',
        group: 'Utilities',
        order: 5,
        isActive: true,
      },
      {
        id: 'contact-utility-2',
        name: 'Heat Utility',
        phone: '0412 48-14-14',
        icon: 'hvac',
        kind: 'utility',
        group: 'Utilities',
        order: 6,
        isActive: true,
      },
    ],
    settings: { cityHotline: '15-80' },
  };

  return {
    contactPatchBodies,
    settingsPatchBodies,
    async handle(route) {
      const request = route.request();
      const url = new URL(request.url());
      const { pathname } = url;

      if (pathname.endsWith('/auth/login')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'admin-contacts-access',
            refreshToken: 'admin-contacts-refresh',
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
              lastName: 'Contacts',
              email: 'admin@example.com',
              role: 'admin',
              address: {},
              preferences: {},
            },
          }),
        });
      }

      if (pathname.endsWith('/contacts/admin') && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ contacts: state.contacts }),
        });
      }

      if (pathname.includes('/contacts/') && request.method() === 'PATCH') {
        const id = pathname.split('/').pop();
        const updates = request.postDataJSON();
        contactPatchBodies.push(updates);
        state.contacts = state.contacts.map((contact) =>
          contact.id === id ? { ...contact, ...updates } : contact,
        );
        const contact = state.contacts.find((entry) => entry.id === id);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ contact }),
        });
      }

      if (pathname.endsWith('/contacts') && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(groupContacts(state.contacts)),
        });
      }

      if (pathname.endsWith('/settings/admin') && request.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ settings: state.settings }),
        });
      }

      if (pathname.endsWith('/settings/admin') && request.method() === 'PATCH') {
        const updates = request.postDataJSON();
        settingsPatchBodies.push(updates);
        state.settings = { ...state.settings, ...updates };
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

      if (pathname.endsWith('/users/admin')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ users: [] }),
        });
      }

      if (pathname.endsWith('/news/admin')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ news: [] }),
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

test('admin contacts and settings persist live edits and the public contacts page reflects them', async ({
  page,
}) => {
  const api = createContactsAndSettingsHarness();
  await page.route('**/api/**', (route) => api.handle(route));

  await login(page);

  await page.goto('/admin/contacts');
  await page.getByRole('link', { name: /Emergency Line/ }).click();
  await page.getByRole('button', { name: /Редагувати/i }).click();
  await page.getByLabel('Порядок').fill('1');
  await page.getByLabel('Статус').click();
  await page.getByRole('button', { name: 'Активне', exact: true }).click();
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();

  await expect
    .poll(() => api.contactPatchBodies.at(-1) ?? null)
    .toMatchObject({ order: 1, isActive: true });

  await page.goto('/admin/settings');
  await expect(page.getByText('15-80')).toBeVisible();
  await page.getByRole('link', { name: /Публічні налаштування/ }).click();
  await page.getByRole('button', { name: /Редагувати/i }).click();
  await page.getByLabel('Гаряча лінія міськради').fill('15-88');
  await page.getByRole('button', { name: 'Зберегти', exact: true }).click();

  await expect
    .poll(() => api.settingsPatchBodies.at(-1)?.cityHotline ?? null)
    .toBe('15-88');

  await page.goto('/services/contacts');
  await expect(page.getByText('15-88')).toBeVisible();
  await expect(page.getByText('Emergency Line')).toBeVisible();
  await expect(page.getByText('Water Utility')).toBeVisible();
});

test('public contacts page shows explicit empty and error states for live data', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname.endsWith('/auth/login')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'public-contacts-access',
          refreshToken: 'public-contacts-refresh',
          user: { firstName: 'Resident', role: 'user' },
        }),
      });
    }

    if (pathname.endsWith('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            firstName: 'Resident',
            lastName: 'Contacts',
            email: 'resident@example.com',
            role: 'user',
            address: {},
            preferences: {},
          },
        }),
      });
    }

    if (pathname.endsWith('/contacts')) {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Contacts feed unavailable' }),
      });
    }

    if (pathname.endsWith('/settings/public')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: { cityHotline: '' } }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await login(page, 'resident', 'password');
  await page.goto('/services/contacts');

  await expect(page.getByText('Номер ще не вказано.')).toBeVisible();
  await expect(page.getByText('Contacts feed unavailable')).toBeVisible();
});
