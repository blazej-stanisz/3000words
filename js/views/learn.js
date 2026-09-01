window.App = window.App || {};
window.App.learn = (function (App) {
  'use strict';

  /**
   * Moduł „Nauka" — wprowadzanie nowych słów.
   *
   * Etapy:
   *   picker   → wybór kategorii
   *   triage   → PL → „Tłumacz" → EN + przykład → „znam" / „nie znam"
   *   intro    → ekran przejściowy
   *   memorize → PL + EN + lektor + „Następne" (tylko słowa nieznane)
   *   summary  → podsumowanie sesji
   */

  const store = App.store;
  const data = App.data;
  const srs = App.srs;
  const tts = App.tts;
  const { html, esc, bar, toast, loader, speakerIcon, wordsLabel } = App.ui;

  let root = null;
  let session = null;
  let ctxRef = null;

  async function render(container, ctx) {
    root = container;
    ctxRef = ctx || null;
    session = null;
    await showPicker();
  }

  function destroy() {
    tts.cancel();
    session = null;
  }

  /* =======================  Wybór kategorii  ======================= */

  async function showPicker() {
    root.replaceChildren(loader('Wczytywanie kategorii…'));
    await data.loadCategories();

    const cats = data.getCategories();
    const byCat = store.statsByCategory();
    const all = store.stats();
    const size = store.settings().sessionSize;

    const frag = html`
      <div>
        <div class="page-head">
          <h1 class="page-title">Nauka</h1>
          <p class="page-sub">Wybierz zakres — w tej sesji poznasz ${size} ${wordsLabel(size)}.</p>
        </div>

        <div class="cat-list">
          <button class="cat cat--all" data-cat="">
            <span class="cat__icon">🌍</span>
            <span class="cat__body">
              <span class="cat__name">Wszystkie kategorie</span>
              <span class="cat__meta">
                <span>${all.mastered} / ${all.total} opanowanych</span>
                <span class="cat__pct">${all.pct}%</span>
              </span>
              ${bar(all.pct, true)}
            </span>
          </button>

          <h2 class="section-title">Kategorie</h2>

          ${cats
            .map((c) => {
              const s = byCat.get(c.id) || { mastered: 0, total: c.count, pct: 0, fresh: c.count };
              const done = s.fresh === 0;
              return `
                <button class="cat" data-cat="${esc(c.id)}"${done ? ' data-done="1"' : ''}>
                  <span class="cat__icon">${c.icon || '📘'}</span>
                  <span class="cat__body">
                    <span class="cat__name">${esc(c.name)}</span>
                    <span class="cat__meta">
                      <span>${s.mastered} / ${s.total} opanowanych</span>
                      <span class="cat__pct">${s.pct}%</span>
                    </span>
                    ${bar(s.pct, true)}
                  </span>
                </button>`;
            })
            .join('')}
        </div>
      </div>
    `;

    frag.querySelectorAll('[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => startSession(btn.dataset.cat || null));
    });

    root.replaceChildren(frag);
  }

  /* =======================  Start sesji  ======================= */

  async function startSession(catId) {
    root.replaceChildren(loader('Przygotowuję słówka…'));

    const limit = store.settings().sessionSize;
    let pool;
    try {
      pool = await store.freshPool(catId);
    } catch (err) {
      console.error(err);
      toast('Nie udało się wczytać słówek');
      return showPicker();
    }

    if (!pool.length) {
      return showAllDone(catId);
    }

    // Pula świeżych słów — bieżące to pool[0]. „Znam" zapisuje słowo jako opanowane
    // i dobiera nowe z puli, więc sesja kończy się, gdy `limit` słów trafi do przegródki 1.
    session = {
      catId,
      pool,
      limit,
      revealed: false,
      known: [],
      unknown: [],
      memIndex: 0,
    };

    renderTriage();
  }

  function showAllDone(catId) {
    const name = catId ? data.getCategory(catId)?.name : 'wszystkich kategoriach';
    const frag = html`
      <div class="empty">
        <div class="empty__icon">🎉</div>
        <div class="empty__title">Brak nowych słówek</div>
        <p class="empty__text">Wszystkie słowa w ${esc(name || 'tej kategorii')} zostały już wprowadzone. Zajrzyj do zakładki <b>Powtórka</b>, żeby utrwalić materiał.</p>
        <button class="btn btn--ghost" data-back>Wróć do kategorii</button>
      </div>
    `;
    frag.querySelector('[data-back]').addEventListener('click', showPicker);
    root.replaceChildren(frag);
  }

  /* =======================  Etap 1: rozpoznawanie  ======================= */

  function renderTriage() {
    const s = session;
    const word = s.pool[0];
    const cat = data.getCategory(word.cat);
    const total = s.limit;
    const pct = (Math.min(s.unknown.length, s.limit) / total) * 100;
    const settings = store.settings();

    const frag = html`
      <div>
        <div class="session-head">
          <button class="icon-btn" data-quit aria-label="Przerwij sesję">✕</button>
          <div class="session-head__bar">${bar(pct)}</div>
          <span class="session-head__count">${Math.min(s.unknown.length + 1, s.limit)}/${total}</span>
        </div>

        <div class="flash">
          <span class="flash__tag">${esc(cat?.name || 'Słownictwo')}</span>

          <div class="flash__prompt">
            <div class="flash__word">${esc(word.pl)}</div>
            <div class="flash__hint">Jak to powiesz po angielsku?</div>
          </div>

          <div data-slot></div>
        </div>
      </div>
    `;

    const slot = frag.querySelector('[data-slot]');
    frag.querySelector('[data-quit]').addEventListener('click', confirmQuit);

    if (!s.revealed) {
      const btn = document.createElement('button');
      btn.className = 'btn btn--primary btn--block btn--lg';
      btn.textContent = 'Tłumacz';
      btn.addEventListener('click', () => {
        s.revealed = true;
        renderTriage();
      });
      slot.appendChild(btn);
    } else {
      slot.appendChild(buildReveal(word, settings, (correct) => answerTriage(correct)));
      if (settings.ttsAuto) tts.speak(word.en);
    }

    root.replaceChildren(frag);
  }

  /** Blok z tłumaczeniem, przykładem i przyciskami oceny. */
  function buildReveal(word, settings, onAnswer) {
    const frag = html`
      <div class="reveal">
        <div class="reveal__answer">
          <span class="reveal__en">${esc(word.en)}</span>
          <button class="speak-btn" data-speak aria-label="Odtwórz wymowę">${speakerIcon()}</button>
        </div>

        ${
          settings.showExamples && word.ex
            ? `<div class="example">
                 <div class="example__en">${esc(word.ex)}</div>
                 ${word.exPl ? `<div class="example__pl">${esc(word.exPl)}</div>` : ''}
               </div>`
            : ''
        }

        <div class="btn-row">
          <button class="btn btn--dont" data-answer="0">Nie znam</button>
          <button class="btn btn--know" data-answer="1">Znam</button>
        </div>

        <p style="margin:10px 0 0;font-size:12.5px;color:var(--text-muted);text-align:center">
          „Znam" — słowo zapisane jako opanowane, w jego miejsce dobiorę nowe.
        </p>
      </div>
    `;

    const speakBtn = frag.querySelector('[data-speak]');
    speakBtn.addEventListener('click', async () => {
      speakBtn.classList.add('is-speaking');
      await tts.speak(word.ex || word.en, { force: true });
      speakBtn.classList.remove('is-speaking');
    });

    frag.querySelectorAll('[data-answer]').forEach((b) => {
      b.addEventListener('click', () => onAnswer(b.dataset.answer === '1'));
    });

    return frag;
  }

  async function answerTriage(correct) {
    const s = session;
    const word = s.pool[0];
    tts.cancel();

    if (correct) {
      // „Znam" — słowo od razu opanowane, poza cyklem powtórek; dobieramy nowe z puli.
      s.known.push(word);
      await store.saveRecord(srs.createMasteredRecord(word));
    } else {
      s.unknown.push(word);
    }

    s.pool.shift();
    s.revealed = false;

    // Koniec sesji: limit słów „nie znam" (reguła użytkownika) lub limit pominięć
    // „znam" (górna granica, żeby sesja nie ciągnęła się przez całą pulę).
    if (s.unknown.length >= s.limit || s.known.length >= s.limit || !s.pool.length) {
      await finishTriage();
    } else {
      renderTriage();
    }
  }

  /* =======================  Etap 2: zapamiętywanie  ======================= */

  async function finishTriage() {
    const s = session;

    // Do przegródki 1 trafiają tylko słowa „nie znam"; „znam" zapisaliśmy już na bieżąco.
    const records = s.unknown.map((w) => srs.createRecord(w, 1));
    if (records.length) await store.saveRecords(records);
    await store.logSession({ type: 'learn', new: records.length + s.known.length, known: s.known.length });

    if (!s.unknown.length) return renderSummary();
    renderIntro();
  }

  function renderIntro() {
    const n = session.unknown.length;
    const frag = html`
      <div class="summary">
        <div class="summary__emoji">🧠</div>
        <h2 class="summary__title">Czas na zapamiętywanie</h2>
        <p class="summary__text">
          ${n} ${wordsLabel(n)} do przyswojenia. Przeczytaj, posłuchaj wymowy
          i spróbuj powtórzyć na głos — to znacząco poprawia zapamiętywanie.
        </p>
        <div class="pill-row">
          <span class="pill pill--success">${session.known.length} już znasz</span>
          <span class="pill pill--danger">${n} do nauki</span>
        </div>
        <button class="btn btn--primary btn--block btn--lg" style="margin-top:20px" data-go>Rozpocznij naukę</button>
      </div>
    `;
    frag.querySelector('[data-go]').addEventListener('click', () => {
      session.memIndex = 0;
      renderMemorize();
    });
    root.replaceChildren(frag);
  }

  function renderMemorize() {
    const s = session;
    const word = s.unknown[s.memIndex];
    const total = s.unknown.length;
    const pct = (s.memIndex / total) * 100;
    const settings = store.settings();

    const frag = html`
      <div>
        <div class="session-head">
          <button class="icon-btn" data-quit aria-label="Przerwij sesję">✕</button>
          <div class="session-head__bar">${bar(pct)}</div>
          <span class="session-head__count">${s.memIndex + 1}/${total}</span>
        </div>

        <div class="flash">
          <span class="flash__tag">Zapamiętaj</span>

          <div class="flash__prompt">
            <div class="flash__word flash__word--sm">${esc(word.pl)}</div>
            <div class="reveal__answer" style="margin-top:6px">
              <span class="reveal__en">${esc(word.en)}</span>
              <button class="speak-btn" data-speak aria-label="Odtwórz wymowę">${speakerIcon()}</button>
            </div>
          </div>

          ${
            settings.showExamples && word.ex
              ? `<div class="example" style="margin-bottom:14px">
                   <div class="example__en">${esc(word.ex)}</div>
                   ${word.exPl ? `<div class="example__pl">${esc(word.exPl)}</div>` : ''}
                 </div>`
              : ''
          }

          <button class="btn btn--primary btn--block btn--lg" data-next>
            ${s.memIndex + 1 >= total ? 'Zakończ naukę' : 'Następne'}
          </button>
        </div>
      </div>
    `;

    const speakBtn = frag.querySelector('[data-speak]');
    speakBtn.addEventListener('click', async () => {
      speakBtn.classList.add('is-speaking');
      await tts.speak(word.ex || word.en, { force: true });
      speakBtn.classList.remove('is-speaking');
    });

    frag.querySelector('[data-quit]').addEventListener('click', confirmQuit);
    frag.querySelector('[data-next]').addEventListener('click', () => {
      tts.cancel();
      s.memIndex++;
      if (s.memIndex >= total) renderSummary();
      else renderMemorize();
    });

    root.replaceChildren(frag);
    if (settings.ttsAuto) tts.speak(word.en);
  }

  /* =======================  Podsumowanie  ======================= */

  function renderSummary() {
    const s = session;
    const learned = s.unknown.length;
    const known = s.known.length;
    const total = learned + known;
    const exhausted = s.pool.length === 0 && s.unknown.length < s.limit;
    const skippedCap = s.known.length >= s.limit && s.pool.length > 0;
    const due = store.dueCount();

    const summaryText =
      learned === 0
        ? skippedCap
          ? `Wszystkie ${total} ${wordsLabel(total)} w tej sesji już znałeś — zapisaliśmy je jako opanowane. Nowe słówka nadal czekają w puli.`
          : `Wszystkie ${total} ${wordsLabel(total)} w tej puli już znałeś — zapisaliśmy je jako opanowane.`
        : `${learned} ${wordsLabel(learned)} trafiło do systemu powtórek` +
          (known ? `, ${known} ${wordsLabel(known)} oznaczone „znam" zapisaliśmy jako opanowane` : '') +
          `.${skippedCap ? ' Osiągnąłeś limit pominiętych słów — reszta nowych słówek czeka w puli.' : ''}${exhausted ? ' W tej puli nie było już więcej nowych słówek.' : ''}`;

    const frag = html`
      <div>
        <div class="summary">
          <div class="summary__emoji">${known >= learned ? '🌟' : '💪'}</div>
          <h2 class="summary__title">Sesja zakończona</h2>
          <p class="summary__text">${summaryText}</p>
          <div class="pill-row">
            <span class="pill pill--success">${known} oznaczonych „znam"</span>
            <span class="pill pill--danger">${learned} w trybie nauki</span>
          </div>
        </div>

        <div class="stack" style="margin-top:16px">
          ${
            due > 0
              ? `<button class="btn btn--primary btn--block btn--lg" data-review>Masz ${due} ${wordsLabel(due)} do powtórki</button>
                 <button class="btn btn--soft btn--block" data-again>Kolejna sesja</button>`
              : `<button class="btn btn--primary btn--block btn--lg" data-again>Kolejna sesja</button>`
          }
          <button class="btn btn--ghost btn--block" data-home>Zakończ naukę</button>
        </div>
      </div>
    `;

    frag.querySelector('[data-again]')?.addEventListener('click', () => startSession(s.catId));
    frag.querySelector('[data-review]')?.addEventListener('click', () => ctxRef?.navigate('review'));
    frag.querySelector('[data-home]').addEventListener('click', () => ctxRef?.navigate('home'));
    root.replaceChildren(frag);
  }

  /* =======================  Przerwanie  ======================= */

  async function confirmQuit() {
    const s = session;
    const seen = s.known.length + s.unknown.length;

    if (seen === 0) {
      tts.cancel();
      return showPicker();
    }

    if (!confirm('Przerwać sesję? Ocenione słowa zostaną zapisane.')) return;

    tts.cancel();

    // „Znam" zapisaliśmy na bieżąco jako opanowane; tu dokładamy tylko nieutrwalone „nie znam".
    const pending = s.unknown
      .filter((w) => !store.hasSeen(w.id))
      .map((w) => srs.createRecord(w, 1));
    if (pending.length) await store.saveRecords(pending);
    if (pending.length || s.known.length) {
      await store.logSession({ type: 'learn', new: pending.length + s.known.length, known: s.known.length });
    }

    toast(`Zapisano ${seen} ${wordsLabel(seen)}`);
    showPicker();
  }

  return { render, destroy };
})(window.App);
