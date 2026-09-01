window.App = window.App || {};
window.App.home = (function (App) {
  'use strict';

  /** Moduł „Start" — ekran powitalny i podsumowanie nauki. */

  const store = App.store;
  const data = App.data;
  const srs = App.srs;
  const { html, bar, loader, wordsLabel, plural } = App.ui;

  const DAY = 86400000;
  const CHART_DAYS = 14;
  const WEEK_LETTERS = ['N', 'P', 'W', 'Ś', 'C', 'P', 'S'];

  let ctxRef = null;

  /* ------------------------- Aktywność ------------------------- */

  /** Liczba słów przerobionych każdego z ostatnich CHART_DAYS dni. */
  function activityByDay(history) {
    const today = srs.startOfDay();
    const days = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      days.push({ ts: today - i * DAY, count: 0 });
    }
    const index = new Map(days.map((d) => [d.ts, d]));
    for (const h of history) {
      const slot = index.get(srs.startOfDay(h.at));
      if (!slot) continue;
      slot.count += h.type === 'review' ? h.cards || 0 : h.new || 0;
    }
    return days;
  }

  function chartMarkup(days) {
    const max = Math.max(1, ...days.map((d) => d.count));
    const today = srs.startOfDay();

    const bars = days
      .map((d) => {
        const pct = d.count ? Math.max(8, Math.round((d.count / max) * 100)) : 0;
        const isToday = d.ts === today;
        const label = new Date(d.ts).getDate();
        return `
        <div class="chart__col${isToday ? ' is-today' : ''}" title="${label}. — ${d.count} ${wordsLabel(d.count)}">
          <div class="chart__track">
            <div class="chart__bar" style="height:${pct}%"></div>
          </div>
          <div class="chart__day">${label}</div>
        </div>`;
      })
      .join('');

    return `<div class="chart">${bars}</div>`;
  }

  /* ------------------------- Seria dni ------------------------- */

  function streakMarkup(history, streakDays) {
    const active = new Set(history.map((h) => srs.startOfDay(h.at)));
    const today = srs.startOfDay();

    const dots = Array.from({ length: 7 }, (_, i) => {
      const ts = today - (6 - i) * DAY;
      const on = active.has(ts);
      const letter = WEEK_LETTERS[new Date(ts).getDay()];
      return `<div class="streak__day${on ? ' is-on' : ''}${ts === today ? ' is-today' : ''}">
                <span class="streak__dot">${on ? '✓' : ''}</span>
                <span class="streak__letter">${letter}</span>
              </div>`;
    }).join('');

    return `
      <div class="card streak">
        <div class="streak__head">
          <div>
            <div class="streak__value">${streakDays} <span>${plural(streakDays, 'dzień', 'dni', 'dni')}</span></div>
            <div class="streak__label">${streakDays ? 'Seria nauki trwa' : 'Zacznij nową serię'}</div>
          </div>
          <div class="streak__flame${streakDays ? ' is-on' : ''}">🔥</div>
        </div>
        <div class="streak__week">${dots}</div>
      </div>`;
  }

  /* ------------------------- Widoki ------------------------- */

  function welcomeMarkup() {
    return html`
      <div>
        <section class="hero hero--welcome">
          <div class="hero__badge">Witaj</div>
          <h1 class="hero__title">Ucz się angielskiego<br>z inteligentnym systemem powtórek</h1>
          <p class="hero__text">
            3000 najważniejszych słów i zwrotów w 20 kategoriach. Aplikacja sama pilnuje,
            co i kiedy powtórzyć, żeby materiał został w pamięci na dobre.
          </p>
          <button class="btn btn--primary btn--lg btn--block" data-go="learn">Rozpocznij naukę</button>
        </section>

        <div class="feature-grid">
          <div class="feature">
            <div class="feature__icon">🗂️</div>
            <div class="feature__title">5 przegródek</div>
            <div class="feature__text">Sprawdzona metoda Leitnera — im lepiej znasz słowo, tym rzadziej wraca.</div>
          </div>
          <div class="feature">
            <div class="feature__icon">🔊</div>
            <div class="feature__title">Lektor</div>
            <div class="feature__text">Każde słowo i przykład możesz usłyszeć w poprawnej wymowie.</div>
          </div>
          <div class="feature">
            <div class="feature__icon">📈</div>
            <div class="feature__title">Postępy</div>
            <div class="feature__text">Widzisz dokładnie, ile słów masz opanowanych i co czeka na powtórkę.</div>
          </div>
          <div class="feature">
            <div class="feature__icon">💾</div>
            <div class="feature__title">Bez konta</div>
            <div class="feature__text">Wszystko działa lokalnie w przeglądarce — bez logowania i bez internetu.</div>
          </div>
        </div>

      </div>
    `;
  }

  function dashboardMarkup(model) {
    const { s, due, todayNew, streakDays, history, sum } = model;
    const inSystem = s.mastered + s.learning;

    const greet = (() => {
      const h = new Date().getHours();
      if (h < 11) return 'Dzień dobry';
      if (h < 18) return 'Miłej nauki';
      return 'Dobry wieczór';
    })();

    const primary = due > 0
      ? `<button class="btn btn--primary btn--lg btn--block" data-go="review">
           Powtórz ${due} ${wordsLabel(due)}
         </button>`
      : `<button class="btn btn--primary btn--lg btn--block" data-go="learn">Poznaj nowe słowa</button>`;

    const secondary = due > 0
      ? `<button class="btn btn--soft btn--block" data-go="learn">Nowe słowa</button>`
      : `<button class="btn btn--soft btn--block" data-go="review">Przegląd powtórek</button>`;

    return html`
      <div>
        <section class="hero">
          <div class="hero__badge">${greet}</div>
          <div class="hero__ring">
            <div class="ring" style="--pct:${s.pct}">
              <div class="ring__center">
                <div class="ring__pct">${s.pct}<span>%</span></div>
                <div class="ring__lbl">opanowane</div>
              </div>
            </div>
            <div class="hero__side">
              <div class="hero__big">${s.mastered}</div>
              <div class="hero__small">z ${s.total} słów</div>
              <div class="hero__meta">
                Poznane dziś: <strong>${todayNew}</strong> ·
                w systemie: <strong>${inSystem}</strong>
              </div>
            </div>
          </div>
        </section>

        <div class="stat-grid stat-grid--3">
          <div class="stat">
            <div class="stat__label">W trakcie nauki</div>
            <div class="stat__value ${s.learning ? 'stat__value--primary' : 'stat__value--muted'}">${s.learning}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Na dziś</div>
            <div class="stat__value ${due ? 'stat__value--warning' : 'stat__value--muted'}">${due}</div>
          </div>
          <div class="stat">
            <div class="stat__label">Opanowane</div>
            <div class="stat__value stat__value--success">${s.mastered}</div>
          </div>
        </div>

        <div class="stack" style="margin-top:14px">
          ${primary}
          ${secondary}
        </div>

        <h2 class="section-title">Twoja seria</h2>
        ${streakMarkup(history, streakDays)}

        <h2 class="section-title">Aktywność — ostatnie 2 tygodnie</h2>
        <div class="card">
          ${chartMarkup(activityByDay(history))}
        </div>

        <h2 class="section-title">Rozkład w przegródkach</h2>
        <div class="card">
          <div class="mini-boxes">
            ${[1, 2, 3, 4, 5]
              .map((n) => {
                const count = sum.boxes[n];
                const max = Math.max(1, ...Object.values(sum.boxes));
                return `<div class="mini-box" style="--bx:var(--box-${n})">
                          <div class="mini-box__bar"><div class="mini-box__fill" style="height:${Math.round((count / max) * 100)}%"></div></div>
                          <div class="mini-box__count">${count}</div>
                          <div class="mini-box__num">${n}</div>
                        </div>`;
              })
              .join('')}
          </div>
          <div class="mini-boxes__foot">
            <span>Świeże</span>
            <span>${s.learning} ${wordsLabel(s.learning)} w nauce</span>
            <span>Znane</span>
          </div>
        </div>

        ${s.fresh > 0
          ? `<p class="home-foot">Przed Tobą jeszcze ${s.fresh} ${wordsLabel(s.fresh)} do poznania.</p>`
          : `<p class="home-foot">Przerobiłeś cały słownik — gratulacje! 🎉</p>`}
      </div>
    `;
  }

  /* ------------------------- Render ------------------------- */

  async function render(container, ctx) {
    ctxRef = ctx;
    container.replaceChildren(loader());
    await data.loadCategories();

    const s = store.stats();
    const started = s.mastered + s.learning > 0;

    if (!started) {
      container.replaceChildren(welcomeMarkup());
    } else {
      const [history, streakDays] = await Promise.all([store.getHistory(), store.streak()]);
      container.replaceChildren(
        dashboardMarkup({
          s,
          due: store.dueCount(),
          todayNew: store.introducedToday(),
          streakDays,
          history,
          sum: store.boxSummary(),
        })
      );
    }

    container.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => ctxRef.navigate(btn.dataset.go));
    });
  }

  return { render };
})(window.App);
