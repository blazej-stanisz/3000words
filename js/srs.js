window.App = window.App || {};
window.App.srs = (function (App) {
  'use strict';

  /**
   * Silnik powtórek - system 5 przegródek (Leitner) wzbogacony
   * o elementy SM-2 (złagodzony reset po pomyłce, rozrzut interwałów).
   *
   * Przegródki i interwały (w dniach):
   *   1 → 1   2 → 2   3 → 4   4 → 8   5 → 16 → opanowane
   *
   * Zasady:
   *  - poprawna odpowiedź: awans o 1 przegródkę; z 5. → status "opanowane"
   *  - błąd z przegródki 1–2: pozostaje w 1 (powtórka tego samego dnia)
   *  - błąd z przegródki 3–5: spadek o 2 poziomy (łagodniejszy niż pełny reset,
   *    co lepiej odpowiada krzywej ponownego uczenia się i nie demotywuje)
   *  - w obrębie jednej sesji błędne słowo wraca do kolejki po kilku innych
   *    kartach (przeplatanie), ale nie może już awansować
   */

  const BOX_COUNT = 5;

  const BOX_INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

  const BOX_LABELS = {
    1: { name: 'Świeże', desc: 'Powtórka codziennie' },
    2: { name: 'Rozpoznawane', desc: 'Powtórka co 2 dni' },
    3: { name: 'Utrwalane', desc: 'Powtórka co 4 dni' },
    4: { name: 'Prawie znane', desc: 'Powtórka co 8 dni' },
    5: { name: 'Znane', desc: 'Powtórka co 16 dni' },
  };

  /** Przegródka odnotowywana w rekordzie słowa oznaczonego od razu jako „znam" (rekord jest od razu opanowany, poza cyklem). */
  const KNOWN_ON_SIGHT_BOX = 3;

  /** Liczba kart, po których błędne słowo wraca w tej samej sesji. */
  const REQUEUE_GAP = 4;

  const DAY = 86400000;

  function now() {
    return Date.now();
  }

  /** Początek dnia (lokalnie) dla podanego znacznika czasu. */
  function startOfDay(ts = Date.now()) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  /** Koniec bieżącego dnia - słowo jest „na dziś", jeśli due <= tej wartości. */
  function endOfToday() {
    return startOfDay() + DAY - 1;
  }

  /**
   * Termin kolejnej powtórki dla danej przegródki.
   * Dodaje losowy rozrzut ±10 %, żeby powtórki nie kumulowały się w jednym dniu,
   * ale nigdy nie planuje słowa na ten sam dzień - najwcześniej jutro.
   */
  function nextDue(box, from = Date.now()) {
    const days = BOX_INTERVALS[box] ?? 1;
    const jitter = 1 + (Math.random() * 0.2 - 0.1);
    const due = startOfDay(from) + Math.round(days * jitter * DAY);
    return Math.max(due, startOfDay(from) + DAY);
  }

  /** Nowy rekord postępu dla świeżo wprowadzonego słowa. */
  function createRecord(word, box, ts = Date.now()) {
    return {
      wordId: word.id,
      cat: word.cat,
      box,
      mastered: false,
      due: nextDue(box, ts),
      reps: 1,
      lapses: 0,
      correctStreak: 1,
      introducedAt: ts,
      lastSeen: ts,
    };
  }

  /**
   * Rekord słowa oznaczonego od razu jako „znam" - poza cyklem powtórek,
   * od razu opanowane (nie wraca do nauki ani do przegródek).
   */
  function createMasteredRecord(word, ts = Date.now()) {
    return {
      ...createRecord(word, KNOWN_ON_SIGHT_BOX, ts),
      mastered: true,
    };
  }

  /**
   * Zastosowanie oceny do rekordu. Zwraca NOWY rekord.
   * @param {object} rec       istniejący rekord postępu
   * @param {boolean} correct  czy użytkownik znał słowo
   * @param {boolean} canPromote  false, gdy słowo już raz zawiodło w tej sesji
   */
  function grade(rec, correct, canPromote = true) {
    const ts = Date.now();
    const next = { ...rec, reps: rec.reps + 1, lastSeen: ts };

    if (correct) {
      if (!canPromote) {
        // Poprawka po błędzie w tej samej sesji - brak awansu, powtórka jutro.
        next.due = nextDue(next.box, ts);
        return next;
      }
      next.correctStreak = (rec.correctStreak || 0) + 1;
      if (rec.box >= BOX_COUNT) {
        next.mastered = true;
        next.box = BOX_COUNT;
        next.due = nextDue(BOX_COUNT, ts);
      } else {
        next.box = rec.box + 1;
        next.due = nextDue(next.box, ts);
      }
      return next;
    }

    // Błąd
    next.lapses = (rec.lapses || 0) + 1;
    next.correctStreak = 0;
    next.mastered = false;
    next.box = rec.box <= 2 ? 1 : Math.max(1, rec.box - 2);
    next.due = startOfDay(ts); // dostępne od razu / dziś
    return next;
  }

  /** Czy słowo czeka na powtórkę? */
  function isDue(rec, at = endOfToday()) {
    return !rec.mastered && rec.due <= at;
  }

  /**
   * Wybór kart do sesji powtórek.
   * Priorytet: największe zaległości → najniższa przegródka → najdłużej nieoglądane.
   */
  function selectReviewQueue(records, limit) {
    const cutoff = endOfToday();
    const due = records.filter((r) => isDue(r, cutoff));

    due.sort((a, b) => {
      const overdueA = cutoff - a.due;
      const overdueB = cutoff - b.due;
      const bucketA = Math.floor(overdueA / DAY);
      const bucketB = Math.floor(overdueB / DAY);
      if (bucketA !== bucketB) return bucketB - bucketA;
      if (a.box !== b.box) return a.box - b.box;
      return a.lastSeen - b.lastSeen;
    });

    return due.slice(0, limit);
  }

  /** Ile słów łącznie czeka na powtórkę (bez limitu sesji). */
  function countDue(records) {
    const cutoff = endOfToday();
    return records.reduce((n, r) => n + (isDue(r, cutoff) ? 1 : 0), 0);
  }

  /** Zestawienie liczności przegródek. */
  function boxSummary(records) {
    const out = {
      boxes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      due: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      mastered: 0,
      learning: 0,
    };
    const cutoff = endOfToday();
    for (const r of records) {
      if (r.mastered) {
        out.mastered++;
        continue;
      }
      out.boxes[r.box]++;
      out.learning++;
      if (r.due <= cutoff) out.due[r.box]++;
    }
    return out;
  }

  /** Ludzki opis odległości czasowej („za 3 dni", „dziś"). */
  function formatDue(ts) {
    const diff = Math.round((startOfDay(ts) - startOfDay()) / DAY);
    if (diff <= 0) return 'dziś';
    if (diff === 1) return 'jutro';
    if (diff < 5) return `za ${diff} dni`;
    return `za ${diff} dni`;
  }

  /** Tasowanie w miejscu (Fisher–Yates). */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return { BOX_COUNT, BOX_INTERVALS, BOX_LABELS, KNOWN_ON_SIGHT_BOX, REQUEUE_GAP, now, startOfDay, endOfToday, nextDue, createRecord, createMasteredRecord, grade, isDue, selectReviewQueue, countDue, boxSummary, formatDue, shuffle };
})(window.App);
