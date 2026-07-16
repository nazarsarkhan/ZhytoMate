import { test, expect } from '@playwright/test';

test('profile address can only be saved after selecting an OpenStreetMap suggestion', async ({ page }) => {
  let addressPatchCalls = 0;
  let addressPatchBody;
  const selectedAddress = {
    id: 'way:1',
    street: 'вулиця Михайлівська',
    building: '3',
    district: 'Корольовський район',
    city: 'Житомир',
    formatted: 'вулиця Михайлівська, 3, Житомир, Україна',
    verified: true,
    lat: 50.254,
    lon: 28.658,
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/users/me/address/suggestions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [selectedAddress] }),
      });
    }

    if (url.pathname.endsWith('/users/me/address/reverse')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ address: selectedAddress }),
      });
    }

    if (url.pathname.endsWith('/users/me/address') && request.method() === 'PATCH') {
      addressPatchCalls += 1;
      addressPatchBody = request.postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { firstName: 'Test', lastName: 'User', address: selectedAddress, preferences: {} } }),
      });
    }

    if (url.pathname.endsWith('/users/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            address: { street: '', building: '', district: '', city: '', verified: false },
            preferences: { utilityAlerts: true, cityNews: true },
          },
        }),
      });
    }

    return route.continue();
  });

  await page.goto('/profile');
  await page.getByRole('button', { name: /Додати адресу/ }).click();

  const saveButton = page.getByRole('button', { name: /Зберегти адресу/ });
  await expect(saveButton).toBeDisabled();

  await page.locator('[data-testid="address-map"]').click({ position: { x: 220, y: 110 } });
  await expect(saveButton).toBeEnabled();

  const addressInput = page.locator('#address-search');
  await addressInput.fill('Михайлівська 3');
  await expect(page.getByRole('option')).toContainText(selectedAddress.formatted);
  await page.getByRole('option').click();

  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  await expect(page.locator('#address-search')).toHaveCount(0);
  expect(addressPatchCalls).toBe(1);
  expect(addressPatchBody).toMatchObject({ query: selectedAddress.formatted, suggestionId: selectedAddress.id });
});
