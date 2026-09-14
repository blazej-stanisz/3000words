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

test('„Znam" wielokrotnie nie kończy sesji ani nie zużywa limitu', async ({ page }) => {
  await openApp(page);

  await page.evaluate(() => { location.hash = 'learn'; });
  await page.locator('.cat--all').click();

  // 10 pominięć „znam" — więcej niż limit sesji (7). Licznik nowych słów stoi,
  // a sesja trwa: „Znam" dobiera kolejne świeże słowo i nie kończy triage'u.
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: 'Tłumacz' }).click();
    await page.getByRole('button', { name: 'Znam', exact: true }).click();
  }

  await expect(page.locator('.session-head__count')).toHaveText('1/7');
  await expect(page.getByRole('button', { name: 'Tłumacz' })).toBeVisible();

  // Dopiero 7 odpowiedzi „nie znam" kończy etap rozpoznawania.
  for (let i = 0; i < 7; i++) {
    await page.getByRole('button', { name: 'Tłumacz' }).click();
    await page.getByRole('button', { name: 'Nie znam' }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Czas na zapamiętywanie');

  const boxes = await page.evaluate(() => App.store.boxSummary());
  expect(boxes.boxes[1]).toBe(7);
  expect(boxes.mastered).toBe(10);
});

test('same „Znam" kończą sesję dopiero na wyczerpaniu świeżej puli', async ({ page }) => {
  await openApp(page);

  // W jednej kategorii zostają tylko 3 świeże słowa (resztę oznaczamy jako znane).
  const catId = await page.evaluate(async () => {
    const cat = App.data.getCategories()[0];
    const words = await App.data.loadWords(cat.id);
    const records = words.slice(3).map((w) => App.srs.createMasteredRecord(w));
    await App.store.saveRecords(records);
    return cat.id;
  });

  await page.evaluate(() => { location.hash = 'learn'; });
  await page.locator(`.cat[data-cat="${catId}"]`).click();

  // Sesja „samymi znam" nie kończy się na limicie 7, tylko na wyczerpaniu puli.
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Tłumacz' }).click();
    await page.getByRole('button', { name: 'Znam', exact: true }).click();
  }

  await expect(page.locator('.summary__title')).toHaveText('Sesja zakończona');
  await expect(page.locator('.summary__text')).toContainText('już znałeś');
  await expect(page.locator('.summary__text')).toContainText('W tej puli nie było już więcej nowych słówek');

  const boxes = await page.evaluate(() => App.store.boxSummary());
  expect(boxes.mastered).toBe(150); // 147 z przygotowania + 3 z sesji
  expect(boxes.boxes[1]).toBe(0);
});
