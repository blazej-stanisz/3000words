// @ts-check
const path = require('path');

/** Adres startowy aplikacji (file:// — bez serwera). */
const APP_URL =
  'file:///' + path.resolve(__dirname, '..', '..', 'index.html').replace(/\\/g, '/');

/** Otwiera aplikację, czeka na start i wyłącza lektora (stabilność i szybkość testów). */
async function openApp(page) {
  await page.goto(APP_URL);
  await page.waitForSelector('.navbar');
  await page.evaluate(() =>
    App.store.updateSettings({ ttsAuto: false, ttsEnabled: false })
  );
}

/**
 * Tworzy `count` zaległych rekordów (due <= teraz), żeby pojawiły się
 * w kolejce powtórek. Zwraca ich id słów.
 */
async function seedDueRecords(page, count) {
  return page.evaluate(async (n) => {
    const words = await App.store.freshPool(null);
    const recs = words.slice(0, n).map((w) => {
      const r = App.srs.createRecord(w, 1, Date.now());
      r.due = Date.now() - 1000; // zaległe — do powtórki od razu
      return r;
    });
    await App.store.saveRecords(recs);
    return recs.map((r) => r.wordId);
  }, count);
}

module.exports = { APP_URL, openApp, seedDueRecords };
