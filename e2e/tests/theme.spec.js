// @ts-check
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

/**
 * Motyw: domyślnie „Automatycznie" (zgodny z ustawieniem systemu), jawny wybór
 * Jasny/Ciemny jest nadrzędny. Sepia została usunięta z aplikacji.
 */

test.describe('motyw automatyczny — ciemny system', () => {
  test.use({ colorScheme: 'dark' });

  test('aplikacja startuje w motywie ciemnym, gdy system jest ciemny', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('jawny wybór „Jasny" nadpisuje ciemny system', async ({ page }) => {
    await openApp(page);

    await page.locator('[data-route="settings"]').click();
    await expect(page.locator('.page-title')).toHaveText('Ustawienia');

    // Przy „Automatycznie" wybór motywu jest nieaktywny — najpierw go wyłączamy.
    await expect(page.locator('[data-theme-set="light"]')).toBeDisabled();

    await page.locator('[data-toggle-auto]').click();
    await expect(page.locator('[data-theme-set="light"]')).toBeEnabled();

    await page.locator('[data-theme-set="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // …i zostaje jasny także po powrocie na Start.
    await page.locator('[data-route="home"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});

test.describe('motyw automatyczny — jasny system', () => {
  test.use({ colorScheme: 'light' });

  test('aplikacja startuje w motywie jasnym, gdy system jest jasny', async ({ page }) => {
    await openApp(page);

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('jawny wybór „Ciemny" nadpisuje jasny system', async ({ page }) => {
    await openApp(page);

    await page.locator('[data-route="settings"]').click();
    await page.locator('[data-toggle-auto]').click();
    await page.locator('[data-theme-set="dark"]').click();

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('[data-toggle-auto]')).not.toHaveClass(/is-on/);
  });

  test('zmiana ustawienia systemu przełącza motyw na żywo', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Użytkownik włącza tryb ciemny w systemie — motyw „automatyczny" idzie za nim.
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Jawny wybór uniezależnia aplikację od systemu.
    await page.locator('[data-route="settings"]').click();
    await page.locator('[data-toggle-auto]').click();
    await page.locator('[data-theme-set="light"]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('motyw zapisany w starszej wersji („sepia") wraca do „Automatycznie"', async ({ page }) => {
    await openApp(page);

    // Tak, jakby użytkownik miał zapisany motyw z poprzedniej wersji aplikacji.
    await page.evaluate(() => App.store.updateSettings({ theme: 'sepia' }));
    await page.reload();
    await page.waitForSelector('.navbar');

    const theme = await page.evaluate(() => App.store.settings().theme);
    expect(theme).toBe('auto');

    // Brak sepii w interfejsie — są tylko Jasny i Ciemny.
    await page.locator('[data-route="settings"]').click();
    await expect(page.locator('[data-theme-set]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Sepia' })).toHaveCount(0);
  });
});
