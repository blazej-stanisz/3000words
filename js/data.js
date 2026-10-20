window.App = window.App || {};
window.App.data = (function (App) {
  'use strict';

  /**
   * Ładowanie i indeksowanie słownika.
   * data/categories.json  → lista kategorii
   * data/words/<id>.json  → tablica słów danej kategorii
   */

  let categories = null;
  const wordsByCat = new Map();
  const wordIndex = new Map();

  /**
   * Pobiera JSON przez fetch, a gdy przeglądarka blokuje to na file://
   * korzysta z wbudowanego pakietu data/bundle.js.
   */
  async function loadJson(url, bundleKey) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_) {
      /* file:// - fetch zablokowany przez CORS */
    }
    const bundled = window.WORDS_BUNDLE && window.WORDS_BUNDLE[bundleKey];
    if (bundled) return bundled;
    throw new Error(`Nie udało się wczytać: ${url}`);
  }

  async function loadCategories() {
    if (categories) return categories;
    categories = await loadJson('data/categories.json', 'categories');
    return categories;
  }

  function getCategories() {
    return categories || [];
  }

  function getCategory(id) {
    return (categories || []).find((c) => c.id === id) || null;
  }

  async function loadWords(catId) {
    if (wordsByCat.has(catId)) return wordsByCat.get(catId);
    const raw = await loadJson(`data/words/${catId}.json`, catId);
    const words = raw.map((w, i) => ({
      id: w.id || `${catId}-${i + 1}`,
      cat: catId,
      en: w.en,
      pl: w.pl,
      ex: w.ex || '',
      exPl: w.exPl || '',
    }));
    wordsByCat.set(catId, words);
    words.forEach((w) => wordIndex.set(w.id, w));
    return words;
  }

  async function loadAllWords() {
    const cats = await loadCategories();
    const chunks = await Promise.all(
      cats.map((c) =>
        loadWords(c.id).catch((err) => {
          console.warn(`Pominięto kategorię ${c.id}:`, err.message);
          return [];
        })
      )
    );
    return chunks.flat();
  }

  function getWord(id) {
    return wordIndex.get(id) || null;
  }

  /** Zwraca liczbę słów w kategorii wg metadanych (bez ładowania pliku). */
  function categorySize(catId) {
    const c = getCategory(catId);
    return c ? c.count : 0;
  }

  function totalWords() {
    return (categories || []).reduce((n, c) => n + c.count, 0);
  }

  return { loadCategories, getCategories, getCategory, loadWords, loadAllWords, getWord, categorySize, totalWords };
})(window.App);
