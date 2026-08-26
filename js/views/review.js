window.App = window.App || {};
window.App.review = (function (App) {
  'use strict';

  /**
   * Moduł „Powtórka" — utrwalanie słów znajdujących się w przegródkach.
   *
   * Karta: PL → „Pokaż" → EN + przykład → „znam" / „nie znam".
   * Błędne słowo wraca do kolejki po kilku innych kartach i musi zostać
   * poprawnie rozpoznane, ale nie awansuje już do wyższej przegródki.
   */

  const store = App.store;
  const data = App.data;
  const srs = App.srs;
  const tts = App.tts;
  const { html, esc, bar, loader, speakerIcon, wordsLabel, toast } = App.ui;

  let root = null;
  let session = null;

  async function render(container) {
    root = container;
    session = null;
    await showStart();
  }

  function destroy() {
    tts.cancel();
    session = null;
  }

  /* =======================  Ekran startowy  ======================= */

  async function showStart() {
    root.replaceChildren(loader('Sprawdzam zaległe powtórki…'));
    await data.loadCategories();

    const due = store.dueCount();
    const limit = store.settings().reviewSize;
    const summary = store.boxSummary();

    if (due === 0) {
      const nothingLearned = summary.learning === 0;
      const frag = html`
        <div class="empty">
          <div class="empty__icon">${nothingLearned ? '📭' : '✅'}</div>
          <div class="empty__title">${nothingLearned ? 'Brak materiału' : 'Wszystko powtórzone'}</div>
          <p class="empty__text">
            ${
              nothingLearned
                ? 'Nie masz jeszcze żadnych słów w przegródkach. Zacznij od zakładki <b>Nauka</b>.'
                : 'Na dziś nie ma zaległych powtórek. Wróć jutro albo wprowadź nowe słówka w zakładce <b>Nauka</b>.'
            }
          </p>
        </div>
      `;
      root.replaceChildren(frag);
      return;
    }

    const planned = Math.min(due, limit);

    const frag = html`
      <div>
        <div class="page-head">
          <h1 class="page-title">Powtórka</h1>
          <p class="page-sub">Utrwalanie słów, które już poznałeś.</p>
        </div>

        <div class="summary">
          <div class="summary__emoji">🔁</div>
          <h2 class="summary__title">${planned} ${wordsLabel(planned)} na teraz</h2>
          <p class="summary__text">
            ${
              due > limit
                ? `Zaległych powtórek: ${due}. Sesja obejmie ${limit} najpilniejszych — krótkie, regularne sesje działają lepiej niż długie maratony.`
                : 'To wszystkie powtórki zaplanowane na dziś.'
            }
          </p>
        </div>

        <div class="stat-grid" style="margin-top:16px">
          <div class="stat">
            <div class="stat__label">W nauce</div>
            <div class="stat__value stat__value--primary">${summary.learning}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Opanowane</div>
            <div class="stat__value stat__value--success">${summary.mastered}</div>
          </div>
        </div>

        <button class="btn btn--primary btn--block btn--lg" style="margin-top:18px" data-go>Rozpocznij powtórkę</button>
      </div>
    `;

    frag.querySelector('[data-go]').addEventListener('click', startSession);
    root.replaceChildren(frag);
  }

  /* =======================  Sesja  ======================= */

  async function startSession() {
    root.replaceChildren(loader('Dobieram słówka…'));

    const cards = await store.pickReviewCards(store.settings().reviewSize);
    if (!cards.length) return showStart();

    session = {
      queue: cards.map((c) => ({ ...c, failed: false })),
      total: cards.length,
      done: 0,
      revealed: false,
      correct: 0,
      wrong: 0,
      promoted: 0,
      demoted: 0,
      mastered: 0,
    };

    renderCard();
  }

  function renderCard() {
    const s = session;
    const card = s.queue[0];
    const word = card.word;
    const cat = data.getCategory(word.cat);
    const pct = (s.done / s.total) * 100;
    const settings = store.settings();

    const frag = html`
      <div>
        <div class="session-head">
          <button class="icon-btn" data-quit aria-label="Przerwij sesję">✕</button>
          <div class="session-head__bar">${bar(pct)}</div>
          <span class="session-head__count">${s.done}/${s.total}</span>
        </div>

        <div class="flash">
          <span class="flash__tag">${esc(cat?.name || 'Powtórka')} · przegródka ${card.rec.box}</span>

          <div class="flash__prompt">
            <div class="flash__word">${esc(word.pl)}</div>
            <div class="flash__hint">${card.failed ? 'Spróbuj jeszcze raz' : 'Przypomnij sobie angielskie słowo'}</div>
          </div>

          <div data-slot></div>
        </div>
      </div>
    `;

    const slot = frag.querySelector('[data-slot]');
    frag.querySelector('[data-quit]').addEventListener('click', quit);

    if (!s.revealed) {
      const btn = document.createElement('button');
      btn.className = 'btn btn--primary btn--block btn--lg';
      btn.textContent = 'Pokaż';
      btn.addEventListener('click', () => {
        s.revealed = true;
        renderCard();
      });
      slot.appendChild(btn);
    } else {
      slot.appendChild(buildReveal(word, settings));
      if (settings.ttsAuto) tts.speak(word.en);
    }

    root.replaceChildren(frag);
  }

  function buildReveal(word, settings) {
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
      </div>
    `;

    const speakBtn = frag.querySelector('[data-speak]');
    speakBtn.addEventListener('click', async () => {
      speakBtn.classList.add('is-speaking');
      await tts.speak(word.ex || word.en, { force: true });
      speakBtn.classList.remove('is-speaking');
    });

    frag.querySelectorAll('[data-answer]').forEach((b) => {
      b.addEventListener('click', () => answer(b.dataset.answer === '1'));
    });

    return frag;
  }

  async function answer(correct) {
    const s = session;
    const card = s.queue.shift();
    tts.cancel();
    s.revealed = false;

    const before = card.rec.box;
    const next = srs.grade(card.rec, correct, !card.failed);
    card.rec = next;
    await store.saveRecord(next);

    if (correct) {
      s.correct++;
      s.done++;
      if (next.mastered) s.mastered++;
      else if (next.box > before) s.promoted++;
    } else {
      s.wrong++;
      card.failed = true;
      if (next.box < before) s.demoted++;
      // Przeplatanie: karta wraca po kilku innych, a nie od razu.
      const pos = Math.min(srs.REQUEUE_GAP, s.queue.length);
      s.queue.splice(pos, 0, card);
    }

    if (!s.queue.length) renderSummary();
    else renderCard();
  }

  /* =======================  Podsumowanie  ======================= */

  function renderSummary() {
    const s = session;
    const accuracy = s.correct + s.wrong ? Math.round((s.correct / (s.correct + s.wrong)) * 100) : 0;

    store.logSession({ type: 'review', cards: s.total, correct: s.correct, wrong: s.wrong });

    const frag = html`
      <div>
        <div class="summary">
          <div class="summary__emoji">${accuracy >= 80 ? '🏆' : accuracy >= 50 ? '👏' : '📚'}</div>
          <h2 class="summary__title">Powtórka zakończona</h2>
          <p class="summary__text">Skuteczność ${accuracy}% — ${s.total} ${wordsLabel(s.total)} przerobionych.</p>
          <div class="pill-row">
            <span class="pill pill--success">${s.promoted} awansowało</span>
            ${s.mastered ? `<span class="pill pill--info">${s.mastered} opanowanych</span>` : ''}
            ${s.demoted ? `<span class="pill pill--danger">${s.demoted} cofniętych</span>` : ''}
          </div>
        </div>

        <div class="stack" style="margin-top:16px">
          ${
            store.dueCount() > 0
              ? '<button class="btn btn--primary btn--block btn--lg" data-again>Kolejna partia</button>'
              : ''
          }
          <button class="btn btn--ghost btn--block" data-back>Zakończ</button>
        </div>
      </div>
    `;

    frag.querySelector('[data-again]')?.addEventListener('click', startSession);
    frag.querySelector('[data-back]').addEventListener('click', showStart);
    root.replaceChildren(frag);
  }

  function quit() {
    const s = session;
    if (s.done + s.wrong > 0 && !confirm('Przerwać powtórkę? Oceny już zapisane zostaną zachowane.')) return;
    tts.cancel();
    if (s.done) toast(`Powtórzono ${s.done} ${wordsLabel(s.done)}`);
    showStart();
  }

  return { render, destroy };
})(window.App);
