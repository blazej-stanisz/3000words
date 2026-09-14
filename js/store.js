window.App = window.App || {};
window.App.store = (function (App) {
  'use strict';

  /**
   * Warstwa stanu aplikacji — ustawienia + postępy w pamięci,
   * z synchronizacją do IndexedDB.
   */

  const db = App.db;
  const data = App.data;
  const srs = App.srs;
  const tts = App.tts;

  const DEFAULT_SETTINGS = {
    theme: 'auto',         // „auto" = zgodnie z ustawieniem systemu (jawny wybór: light/dark)
    sessionSize: 7,        // liczba nowych słów w sesji nauki
    reviewSize: 25,        // maks. kart w sesji powtórek
    ttsEnabled: true,      // lektor włączony
    ttsAuto: true,         // automatyczne czytanie po odsłonięciu
    ttsRate: 0.9,
    ttsVoice: '',
    showExamples: true,
  };

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    progress: new Map(),   // wordId → rekord
    loaded: false,
  };

  /* ------------------------- Inicjalizacja ------------------------- */

  async function init() {
    const saved = await db.getMeta('settings', null);
    if (saved) state.settings = { ...DEFAULT_SETTINGS, ...saved };
    // Motyw zapisany w starszej wersji (np. „sepia") → domyślne „automatycznie".
    if (!['auto', 'light', 'dark'].includes(state.settings.theme)) {
      state.settings.theme = DEFAULT_SETTINGS.theme;
    }

    const records = await db.getAllProgress();
    state.progress = new Map(records.map((r) => [r.wordId, r]));
    state.loaded = true;

    applyTtsSettings();
    return state;
  }

  function applyTtsSettings() {
    tts.configure({
      enabled: state.settings.ttsEnabled,
      rate: state.settings.ttsRate,
      voiceURI: state.settings.ttsVoice || null,
    });
  }

  /* ------------------------- Ustawienia ------------------------- */

  function settings() {
    return state.settings;
  }

  async function updateSettings(patch) {
    state.settings = { ...state.settings, ...patch };
    applyTtsSettings();
    await db.setMeta('settings', state.settings);
    return state.settings;
  }

  /* ------------------------- Postępy ------------------------- */

  function allRecords() {
    return [...state.progress.values()];
  }

  function record(wordId) {
    return state.progress.get(wordId) || null;
  }

  function hasSeen(wordId) {
    return state.progress.has(wordId);
  }

  async function saveRecord(rec) {
    state.progress.set(rec.wordId, rec);
    await db.putProgress(rec);
  }

  async function saveRecords(recs) {
    recs.forEach((r) => state.progress.set(r.wordId, r));
    await db.putProgressBatch(recs);
  }

  async function resetProgress() {
    state.progress.clear();
    await db.clearProgress();
  }

  /* ------------------------- Statystyki ------------------------- */

  /** Statystyki globalne lub dla jednej kategorii. */
  function stats(catId = null) {
    const cats = data.getCategories();
    const total = catId
      ? data.categorySize(catId)
      : cats.reduce((n, c) => n + c.count, 0);

    let mastered = 0;
    let learning = 0;
    for (const r of state.progress.values()) {
      if (catId && r.cat !== catId) continue;
      if (r.mastered) mastered++;
      else learning++;
    }

    return {
      total,
      mastered,
      learning,
      fresh: Math.max(0, total - mastered - learning),
      pct: total ? Math.round((mastered / total) * 100) : 0,
    };
  }

  /** Statystyki dla wszystkich kategorii naraz (jedno przejście po rekordach). */
  function statsByCategory() {
    const map = new Map();
    for (const c of data.getCategories()) {
      map.set(c.id, { total: c.count, mastered: 0, learning: 0, fresh: c.count, pct: 0 });
    }
    for (const r of state.progress.values()) {
      const s = map.get(r.cat);
      if (!s) continue;
      if (r.mastered) s.mastered++;
      else s.learning++;
    }
    for (const s of map.values()) {
      s.fresh = Math.max(0, s.total - s.mastered - s.learning);
      s.pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
    }
    return map;
  }

  function dueCount() {
    return srs.countDue(allRecords());
  }

  function boxSummary() {
    return srs.boxSummary(allRecords());
  }

  /* ------------------------- Dobór słów ------------------------- */

  /**
   * Losuje nowe (jeszcze niewprowadzone) słowa do sesji nauki.
   * @param {string|null} catId  null = wszystkie kategorie
   * @param {number} limit
   */
  async function pickNewWords(catId, limit) {
    return (await freshPool(catId)).slice(0, limit);
  }

  /** Wszystkie niewprowadzone jeszcze słowa (bez limitu), potasowane. */
  async function freshPool(catId) {
    const pool = catId ? await data.loadWords(catId) : await data.loadAllWords();
    return srs.shuffle(pool.filter((w) => !state.progress.has(w.id)));
  }

  /** Zwraca karty do sesji powtórek (rekord + pełne dane słowa). */
  async function pickReviewCards(limit) {
    const queue = srs.selectReviewQueue(allRecords(), limit);
    if (!queue.length) return [];

    const needed = new Set(queue.map((r) => r.cat));
    await Promise.all([...needed].map((c) => data.loadWords(c)));

    return queue
      .map((rec) => ({ rec, word: data.getWord(rec.wordId) }))
      .filter((c) => c.word);
  }

  /* ------------------------- Historia sesji ------------------------- */

  async function logSession(entry) {
    const hist = (await db.getMeta('history', [])) || [];
    hist.push({ ...entry, at: Date.now() });
    await db.setMeta('history', hist.slice(-200));
  }

  async function getHistory() {
    return (await db.getMeta('history', [])) || [];
  }

  /** Liczba słów wprowadzonych dzisiaj. */
  function introducedToday() {
    const from = srs.startOfDay();
    let n = 0;
    for (const r of state.progress.values()) {
      if (r.introducedAt >= from) n++;
    }
    return n;
  }

  /** Aktualna seria dni z nauką (streak). */
  async function streak() {
    const hist = await getHistory();
    if (!hist.length) return 0;
    const days = new Set(hist.map((h) => srs.startOfDay(h.at)));
    const DAY = 86400000;
    let cursor = srs.startOfDay();
    if (!days.has(cursor)) cursor -= DAY;
    let n = 0;
    while (days.has(cursor)) {
      n++;
      cursor -= DAY;
    }
    return n;
  }

  return { DEFAULT_SETTINGS, init, settings, updateSettings, allRecords, record, hasSeen, saveRecord, saveRecords, resetProgress, stats, statsByCategory, dueCount, boxSummary, pickNewWords, freshPool, pickReviewCards, logSession, getHistory, introducedToday, streak };
})(window.App);
