window.App = window.App || {};
window.App.boxes = (function (App) {
  'use strict';

  /** Moduł „Przegródki" - rozkład słów w systemie Leitnera. */

  const store = App.store;
  const data = App.data;
  const srs = App.srs;
  const { html, bar, loader, wordsLabel } = App.ui;

  async function render(container) {
    container.replaceChildren(loader());
    await data.loadCategories();

    const sum = store.boxSummary();
    const s = store.stats();
    const inSystem = sum.learning + sum.mastered;
    const maxCount = Math.max(1, ...Object.values(sum.boxes), sum.mastered);
    const totalDue = Object.values(sum.due).reduce((a, b) => a + b, 0);

    const rows = [1, 2, 3, 4, 5]
      .map((n) => {
        const meta = srs.BOX_LABELS[n];
        const count = sum.boxes[n];
        const due = sum.due[n];
        return `
        <div class="box-row" style="--bx: var(--box-${n})">
          <div class="box-row__num">${n}</div>
          <div class="box-row__body">
            <div class="box-row__title">${meta.name}</div>
            <div class="box-row__desc">${meta.desc}</div>
            <div class="box-row__meter">${bar(maxCount ? (count / maxCount) * 100 : 0, true)}</div>
          </div>
          <div>
            <div class="box-row__count">${count}</div>
            <div class="box-row__due">${due ? `${due} na dziś` : '-'}</div>
          </div>
        </div>`;
      })
      .join('');

    const frag = html`
      <div>
        <div class="page-head">
          <h1 class="page-title">Przegródki</h1>
          <p class="page-sub">System 5 przegródek - każdy poprawny wynik przesuwa słowo wyżej i wydłuża odstęp przed kolejną powtórką.</p>
        </div>

        <div class="stat-grid">
          <div class="stat">
            <div class="stat__label">W systemie</div>
            <div class="stat__value stat__value--primary">${inSystem}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Na dziś</div>
            <div class="stat__value ${totalDue ? 'stat__value--warning' : 'stat__value--muted'}">${totalDue}</div>
          </div>
        </div>

        <h2 class="section-title">Rozkład słów</h2>
        <div class="box-list">
          ${rows}
          <div class="box-row" style="--bx: var(--box-done)">
            <div class="box-row__num">✓</div>
            <div class="box-row__body">
              <div class="box-row__title">Opanowane</div>
              <div class="box-row__desc">Poza cyklem powtórek</div>
              <div class="box-row__meter">${bar(maxCount ? (sum.mastered / maxCount) * 100 : 0, true)}</div>
            </div>
            <div>
              <div class="box-row__count">${sum.mastered}</div>
              <div class="box-row__due">-</div>
            </div>
          </div>
        </div>

        <h2 class="section-title">Jak to działa</h2>
        <div class="card">
          <p style="font-size:13.5px;line-height:1.6;color:var(--text-soft);margin:0">
            Nowe słowo trafia do <b>przegródki 1</b>. Każda poprawna odpowiedź przesuwa je o jeden poziom wyżej,
            a odstęp do kolejnej powtórki rośnie: 1 → 2 → 4 → 8 → 16 dni. Po poprawnej odpowiedzi
            w przegródce 5 słowo uznajemy za <b>opanowane</b>.
          </p>
          <p style="font-size:13.5px;line-height:1.6;color:var(--text-soft);margin:10px 0 0">
            Pomyłka w przegródce 1–2 zostawia słowo na poziomie 1. Z wyższych przegródek słowo spada o dwa
            poziomy - łagodniej niż pełny reset, dzięki czemu nie tracisz całego dorobku po jednej wpadce.
            Słowo, które w danej sesji raz zawiodło, wraca w kolejce, ale nie awansuje.
          </p>
        </div>

        ${
          s.fresh > 0
            ? `<p style="margin-top:14px;font-size:13px;color:var(--text-muted);text-align:center">
                 Poza systemem czeka jeszcze ${s.fresh} ${wordsLabel(s.fresh)}.
               </p>`
            : ''
        }
      </div>
    `;

    container.replaceChildren(frag);
  }

  return { render };
})(window.App);
