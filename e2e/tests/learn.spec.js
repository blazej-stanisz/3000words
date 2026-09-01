// @ts-check
const { test, expect } = require('@playwright/test');
const { openApp } = require('./helpers');

test('sesja nauki kończy się po limicie „nie znam" i słowa trafiają do przegródek', async ({ page }) => {
  await openApp(page);

  // Nauka ukryta w menu (prezentacja) — wejście przez hash routera.
  await page.evaluate(() => { location.hash = 'learn'; });
  await page.locator('.cat--all').click();

  // Triage: 7× „Nie znam" = domyślny limit sesji (7).
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'Tłumacz' }).click();
    await page.getByRole('button', { name: 'Nie znam' }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Czas na zapamiętywanie');
  await page.getByRole('button', { name: 'Rozpocznij naukę' }).click();

  // Etap zapamiętywania: 7 kart (ostatnia kończy przyciskiem „Zakończ naukę").
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: /Następne|Zakończ naukę/ }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Sesja zakończona');
  await expect(page.locator('.summary__text')).toContainText('trafiło do systemu powtórek');

  // Dokładnie 7 nowych słów w przegródce 1, żadnych opanowanych.
  const boxes = await page.evaluate(() => App.store.boxSummary());
  expect(boxes.boxes[1]).toBe(7);
  expect(boxes.mastered).toBe(0);
});

test('„Znam" zapisuje słowo jako opanowane i nie zużywa limitu sesji', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => { location.hash = 'learn'; });
  await page.locator('.cat--all').click();

  // 1× „Znam" + 7× „Nie znam" — licznik „nie znam" to 7 = koniec triage.
  await page.getByRole('button', { name: 'Tłumacz' }).click();
  await page.getByRole('button', { name: 'Znam', exact: true }).click();
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'Tłumacz' }).click();
    await page.getByRole('button', { name: 'Nie znam' }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Czas na zapamiętywanie');
  await page.getByRole('button', { name: 'Rozpocznij naukę' }).click();
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: /Następne|Zakończ naukę/ }).click();
  }

  await expect(page.locator('.summary__text')).toContainText('1 słowo oznaczone „znam" zapisaliśmy jako opanowane');

  const boxes = await page.evaluate(() => App.store.boxSummary());
  expect(boxes.boxes[1]).toBe(7);
  expect(boxes.mastered).toBe(1);
});
