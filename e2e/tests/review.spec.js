// @ts-check
const { test, expect } = require('@playwright/test');
const { openApp, seedDueRecords } = require('./helpers');

test('powtórka kończy się podsumowaniem i automatycznym powrotem na start', async ({ page }) => {
  await openApp(page);
  await seedDueRecords(page, 3);

  await page.locator('[data-route="review"]').click();
  await page.getByRole('button', { name: 'Rozpocznij powtórkę' }).click();

  // 3 karty: „Pokaż" + „Znam".
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await page.getByRole('button', { name: 'Znam', exact: true }).click();
  }

  // Podsumowanie z odliczaniem do przekierowania.
  await expect(page.locator('.summary__title')).toHaveText('Powtórka zakończona');
  await expect(page.locator('[data-redirect-note]')).toContainText('Strona główna za');

  // Automatyczne przekierowanie na stronę główną po ~5 s.
  await expect(page).toHaveURL(/#home$/, { timeout: 8000 });
  await expect(page.locator('.navbar__item.is-active[data-route="home"]')).toBeVisible();
});

test('przycisk „Zakończ" na podsumowaniu powtórki natychmiast wraca na start', async ({ page }) => {
  await openApp(page);
  await seedDueRecords(page, 3);

  await page.locator('[data-route="review"]').click();
  await page.getByRole('button', { name: 'Rozpocznij powtórkę' }).click();

  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Pokaż' }).click();
    await page.getByRole('button', { name: 'Znam', exact: true }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Powtórka zakończona');
  await page.getByRole('button', { name: 'Zakończ' }).click();

  await expect(page).toHaveURL(/#home$/, { timeout: 3000 });
});
