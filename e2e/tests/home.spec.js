// @ts-check
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test('aplikacja startuje i pokazuje ekran główny z nawigacją', async ({ page }) => {
  await openApp(page);

  await expect(page).toHaveTitle(/3000 Words/);

  // Dolna nawigacja: Start, Nauka, Powtórka, Postępy, Przegródki.
  await expect(page.locator('.navbar__item')).toHaveCount(5);

  // Pierwsze uruchomienie (czysty profil) -> ekran powitalny.
  await expect(page.getByRole('button', { name: 'Rozpocznij naukę' })).toBeVisible();
  await expect(page.locator('.hero__title')).toContainText('angielskiego');
});

test('nawigacja między zakładkami działa (Start -> Nauka -> Powtórka)', async ({ page }) => {
  await openApp(page);

  await page.locator('[data-route="learn"]').click();
  await expect(page.locator('.page-title')).toHaveText('Nauka');

  await page.locator('[data-route="review"]').click();
  // Czysty profil: brak słów w przegródkach -> ekran „Brak materiału".
  await expect(page.locator('.empty__title')).toHaveText('Brak materiału');

  // Przycisk „Powrót do ekranu głównego" na pustym ekranie powtórki.
  const backHome = page.getByRole('button', { name: 'Powrót do ekranu głównego' });
  await expect(backHome).toBeVisible();
  await backHome.click();
  await expect(page.locator('.navbar__item.is-active[data-route="home"]')).toBeVisible();
});
