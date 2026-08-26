window.App = window.App || {};
window.App.settings = (function (App) {
  'use strict';

  /** Moduł „Ustawienia". */

  const store = App.store;
  const tts = App.tts;
  const { html, esc, toast } = App.ui;

  const THEMES = [
    { id: 'light', label: 'Jasny' },
    { id: 'sepia', label: 'Sepia' },
    { id: 'dark', label: 'Ciemny' },
  ];

  async function render(container, ctx) {
    const s = store.settings();
    const voices = tts.getVoices();

    const frag = html`
      <div>
        <div class="page-head">
          <h1 class="page-title">Ustawienia</h1>
          <p class="page-sub">Dopasuj tempo nauki i wygląd aplikacji.</p>
        </div>

        <h2 class="section-title">Sesje</h2>
        <div class="stack-sm">
          <div class="setting">
            <div>
              <div class="setting__label">Nowe słowa na sesję</div>
              <div class="setting__desc">Ile nowych słów wprowadzić w jednej sesji nauki. 5–10 to zakres najlepiej wspierający zapamiętywanie.</div>
            </div>
            <div class="stepper" data-stepper="sessionSize" data-min="3" data-max="30" data-step="1">
              <button data-dir="-1" aria-label="Mniej">−</button>
              <span class="stepper__val">${s.sessionSize}</span>
              <button data-dir="1" aria-label="Więcej">+</button>
            </div>
          </div>

          <div class="setting">
            <div>
              <div class="setting__label">Kart na powtórkę</div>
              <div class="setting__desc">Maksymalna długość jednej sesji powtórek. Krótkie, częste sesje są skuteczniejsze niż długie.</div>
            </div>
            <div class="stepper" data-stepper="reviewSize" data-min="10" data-max="60" data-step="5">
              <button data-dir="-1" aria-label="Mniej">−</button>
              <span class="stepper__val">${s.reviewSize}</span>
              <button data-dir="1" aria-label="Więcej">+</button>
            </div>
          </div>

          <div class="setting">
            <div>
              <div class="setting__label">Przykłady użycia</div>
              <div class="setting__desc">Pokazuj zdanie z przykładem po odsłonięciu tłumaczenia.</div>
            </div>
            <button class="switch${s.showExamples ? ' is-on' : ''}" data-toggle="showExamples" role="switch" aria-checked="${s.showExamples}"></button>
          </div>
        </div>

        <h2 class="section-title">Lektor</h2>
        <div class="stack-sm">
          ${
            tts.supported
              ? `
          <div class="setting">
            <div>
              <div class="setting__label">Wymowa</div>
              <div class="setting__desc">Odtwarzanie angielskiej wymowy przez syntezator mowy.</div>
            </div>
            <button class="switch${s.ttsEnabled ? ' is-on' : ''}" data-toggle="ttsEnabled" role="switch" aria-checked="${s.ttsEnabled}"></button>
          </div>

          <div class="setting">
            <div>
              <div class="setting__label">Czytaj automatycznie</div>
              <div class="setting__desc">Wypowiadaj słowo od razu po odsłonięciu tłumaczenia.</div>
            </div>
            <button class="switch${s.ttsAuto ? ' is-on' : ''}" data-toggle="ttsAuto" role="switch" aria-checked="${s.ttsAuto}"></button>
          </div>

          <div class="setting setting--col">
            <div>
              <div class="setting__label">Głos</div>
              <div class="setting__desc">Dostępne głosy zależą od systemu i przeglądarki.</div>
            </div>
            <select class="select" data-voice>
              <option value="">Automatyczny</option>
              ${voices
                .map(
                  (v) =>
                    `<option value="${esc(v.voiceURI)}"${v.voiceURI === s.ttsVoice ? ' selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`
                )
                .join('')}
            </select>
            <button class="btn btn--soft" data-test-voice>Przetestuj wymowę</button>
          </div>

          <div class="setting setting--col">
            <div>
              <div class="setting__label">Tempo mowy <span data-rate-val style="color:var(--primary)">${s.ttsRate.toFixed(1)}×</span></div>
            </div>
            <input class="range" type="range" min="0.5" max="1.4" step="0.1" value="${s.ttsRate}" data-rate>
          </div>`
              : `<div class="setting"><div><div class="setting__label">Lektor niedostępny</div><div class="setting__desc">Twoja przeglądarka nie obsługuje syntezatora mowy (Web Speech API).</div></div></div>`
          }
        </div>

        <h2 class="section-title">Wygląd</h2>
        <div class="setting setting--col">
          <div>
            <div class="setting__label">Motyw kolorystyczny</div>
          </div>
          <div class="seg seg--theme" data-theme-seg>
            ${THEMES.map(
              (t) => `<button data-theme-set="${t.id}" class="${s.theme === t.id ? 'is-active' : ''}">
                        <span class="seg__swatch" data-theme-dot="${t.id}"></span>
                        <span>${t.label}</span>
                      </button>`
            ).join('')}
          </div>
        </div>

        <h2 class="section-title">Dane</h2>
        <div class="stack-sm">
          <div class="setting setting--col">
            <div>
              <div class="setting__label">Reset postępów</div>
              <div class="setting__desc">Usuwa wszystkie przegródki, statystyki i historię sesji. Operacja nieodwracalna.</div>
            </div>
            <button class="btn btn--danger-solid" data-reset>Wyczyść wszystkie postępy</button>
          </div>
        </div>

        <p style="margin:22px 0 0;font-size:12px;color:var(--text-muted);text-align:center;line-height:1.5">
          Postępy zapisywane są lokalnie w tej przeglądarce.
        </p>
      </div>
    `;

    /* ---------- Steppery ---------- */
    frag.querySelectorAll('[data-stepper]').forEach((wrap) => {
      const key = wrap.dataset.stepper;
      const min = +wrap.dataset.min;
      const max = +wrap.dataset.max;
      const step = +wrap.dataset.step;
      const val = wrap.querySelector('.stepper__val');

      const sync = () => {
        const v = store.settings()[key];
        val.textContent = v;
        wrap.querySelector('[data-dir="-1"]').disabled = v <= min;
        wrap.querySelector('[data-dir="1"]').disabled = v >= max;
      };

      wrap.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', async () => {
          const cur = store.settings()[key];
          const next = Math.max(min, Math.min(max, cur + +b.dataset.dir * step));
          if (next === cur) return;
          await store.updateSettings({ [key]: next });
          sync();
        })
      );
      sync();
    });

    /* ---------- Przełączniki ---------- */
    frag.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.toggle;
        const next = !store.settings()[key];
        await store.updateSettings({ [key]: next });
        btn.classList.toggle('is-on', next);
        btn.setAttribute('aria-checked', String(next));
      });
    });

    /* ---------- Lektor ---------- */
    frag.querySelector('[data-voice]')?.addEventListener('change', async (e) => {
      await store.updateSettings({ ttsVoice: e.target.value });
      tts.speak('This is how I sound.', { force: true });
    });

    frag.querySelector('[data-test-voice]')?.addEventListener('click', () => {
      tts.speak('Practice makes perfect.', { force: true });
    });

    const rate = frag.querySelector('[data-rate]');
    if (rate) {
      const label = frag.querySelector('[data-rate-val]');
      rate.addEventListener('input', () => {
        label.textContent = `${(+rate.value).toFixed(1)}×`;
      });
      rate.addEventListener('change', async () => {
        await store.updateSettings({ ttsRate: +rate.value });
        tts.speak('Practice makes perfect.', { force: true });
      });
    }

    /* ---------- Motyw ---------- */
    frag.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const theme = btn.dataset.themeSet;
        await ctx.setTheme(theme);
        frag.querySelectorAll('[data-theme-set]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        container.querySelectorAll('[data-theme-set]').forEach((b) =>
          b.classList.toggle('is-active', b.dataset.themeSet === theme)
        );
      });
    });

    /* ---------- Reset ---------- */
    frag.querySelector('[data-reset]').addEventListener('click', async () => {
      if (!confirm('Na pewno usunąć wszystkie postępy? Tej operacji nie da się cofnąć.')) return;
      await store.resetProgress();
      toast('Postępy wyczyszczone');
      render(container, ctx);
    });

    container.replaceChildren(frag);
  }

  return { render };
})(window.App);
