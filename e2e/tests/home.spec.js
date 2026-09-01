// @ts-check
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test('aplikacja startuje i pokazuje ekran główny z nawigacją', async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle(/3000 Words/);

  // Slot reklamy (mock) + pasek z nazwą aplikacji na każdej stronie.
  await expect(page.locator('.ad-slot')).toBeVisible();
  await expect(page.locator('.brand-bar')).toContainText('3000 Words');

  // Dolna nawigacja: widoczne Start, Postępy, Przegródki, Ustawienia.
  await expect(page.locator('.navbar__item:visible')).toHaveCount(4);

  // Nauka i Powtórka ukryte (tryb prezentacji) — ale widoki dalej działają.
  await expect(page.locator('[data-route="learn"]')).toBeHidden();
  await expect(page.locator('[data-route="review"]')).toBeHidden();

  // Pierwsze uruchomienie (czysty profil) -> ekran powitalny.
  await expect(page.getByRole('button', { name: 'Rozpocznij naukę' })).toBeVisible();
  await expect(page.locator('.hero__title')).toContainText('angielskiego');
});

test('nawigacja między zakładkami działa (Start -> Nauka -> Powtórka)', async ({ page }) => {
  await openApp(page);

  // Nauka/Powtórka są ukryte w menu (prezentacja) — wchodzimy przez hash routera.
  await page.evaluate(() => { location.hash = 'learn'; });
  await expect(page.locator('.page-title')).toHaveText('Nauka');

  await page.evaluate(() => { location.hash = 'review'; });
  // Czysty profil: brak słów w przegródkach -> ekran „Brak materiału".
  await expect(page.locator('.empty__title')).toHaveText('Brak materiału');

  // Przycisk „Powrót do ekranu głównego" na pustym ekranie powtórki.
  const backHome = page.getByRole('button', { name: 'Powrót do ekranu głównego' });
  await expect(backHome).toBeVisible();
  await backHome.click();
  await expect(page.locator('.navbar__item.is-active[data-route="home"]')).toBeVisible();
});

test('motyw zmienia się z poziomu Ustawień (dolny pasek)', async ({ page }) => {
  await openApp(page);

  await page.locator('[data-route="settings"]').click();
  await expect(page.locator('.page-title')).toHaveText('Ustawienia');

  // Sekcja „Wygląd" — zmiana motywu działa.
  await page.locator('[data-theme-set="dark"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.locator('[data-route="home"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
