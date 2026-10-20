window.App = window.App || {};
window.App.stats = (function (App) {
  'use strict';

  /** Moduł „Postępy" - podsumowanie nauki. */

  const store = App.store;
  const data = App.data;
  const { html, esc, bar, loader, wordsLabel } = App.ui;

  async function render(container) {
    container.replaceChildren(loader());
    await data.loadCategories();

    const s = store.stats();
    const byCat = store.statsByCategory();
    const due = store.dueCount();
    const today = store.introducedToday();
    const streak = await store.streak();

    const segments = [
      { key: 'mastered', label: 'Opanowane', value: s.mastered, color: 'var(--success)' },
      { key: 'learning', label: 'W nauce', value: s.learning, color: 'var(--primary)' },
      { key: 'fresh', label: 'Nierozpoczęte', value: s.fresh, color: 'var(--surface-3)' },
    ];

    const cats = [...byCat.entries()]
      .map(([id, st]) => ({ id, st, cat: data.getCategory(id) }))
      .filter((r) => r.cat)
      .sort((a, b) => b.st.pct - a.st.pct || a.cat.name.localeCompare(b.cat.name, 'pl'));

    const frag = html`
      <div>
        <div class="page-head">
          <h1 class="page-title">Postępy</h1>
          <p class="page-sub">${s.mastered} z ${s.total} ${wordsLabel(s.total)} opanowanych</p>
        </div>

        <div class="card">
          <div class="donut-wrap">
            ${donut(segments, s.pct)}
            <div class="legend">
              ${segments
                .map(
                  (seg) => `
                <div class="legend__row">
                  <span class="legend__swatch" style="background:${seg.color}"></span>
                  <span class="legend__name">${seg.label}</span>
                  <span class="legend__val">${seg.value}</span>
                </div>`
                )
                .join('')}
            </div>
          </div>
        </div>

        <h2 class="section-title">Dziś</h2>
        <div class="stat-grid">
          <div class="stat">
            <div class="stat__label">Do powtórki</div>
            <div class="stat__value ${due ? 'stat__value--warning' : 'stat__value--muted'}">${due}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Nowe słowa</div>
            <div class="stat__value stat__value--primary">${today}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Seria dni</div>
            <div class="stat__value stat__value--success">${streak} 🔥</div>
          </div>
          <div class="stat">
            <div class="stat__label">Pozostało</div>
            <div class="stat__value stat__value--muted">${s.fresh}</div>
          </div>
        </div>

        <h2 class="section-title">Kategorie</h2>
        <div class="cat-list">
          ${cats
            .map(
              ({ st, cat }) => `
            <div class="cat" style="cursor:default">
              <span class="cat__icon">${cat.icon || '📘'}</span>
              <span class="cat__body">
                <span class="cat__name">${esc(cat.name)}</span>
                <span class="cat__meta">
                  <span>${st.mastered} / ${st.total} · w nauce ${st.learning}</span>
                  <span class="cat__pct">${st.pct}%</span>
                </span>
                ${bar(st.pct, true)}
              </span>
            </div>`
            )
            .join('')}
        </div>
      </div>
    `;

    container.replaceChildren(frag);
  }

  /** Pierścień SVG złożony z segmentów. */
  function donut(segments, pct) {
    const total = segments.reduce((n, s) => n + s.value, 0) || 1;
    const r = 66;
    const c = 2 * Math.PI * r;
    let offset = 0;

    const arcs = segments
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = (s.value / total) * c;
        const el = `<circle cx="84" cy="84" r="${r}" fill="none" stroke="${s.color}"
          stroke-width="17" stroke-linecap="butt"
          stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}"
          stroke-dashoffset="${(-offset).toFixed(2)}" />`;
        offset += len;
        return el;
      })
      .join('');

    return `
      <div class="donut">
        <svg viewBox="0 0 168 168">
          <circle cx="84" cy="84" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="17"/>
          ${arcs}
        </svg>
        <div class="donut__center">
          <span class="donut__pct">${pct}%</span>
          <span class="donut__lbl">opanowane</span>
        </div>
      </div>`;
  }

  return { render };
})(window.App);
