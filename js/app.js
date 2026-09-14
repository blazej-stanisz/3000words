window.App = window.App || {};
(function (App) {
  'use strict';

  /** Punkt wejścia — inicjalizacja, motyw i router. */

  const home = App.home;
  const store = App.store;
  const tts = App.tts;
  const learn = App.learn;
  const review = App.review;
  const stats = App.stats;
  const boxes = App.boxes;
  const settings = App.settings;
  const { $, $$, toast, html } = App.ui;

  const ROUTES = {
    home: { view: home, title: 'Start' },
    learn: { view: learn, title: 'Nauka' },
    review: { view: review, title: 'Powtórka' },
    stats: { view: stats, title: 'Postępy' },
    boxes: { view: boxes, title: 'Przegródki' },
    settings: { view: settings, title: 'Ustawienia' },
  };

  const THEMES = ['auto', 'light', 'dark'];
  const EXPLICIT_THEMES = ['light', 'dark'];
  const THEME_COLORS = { light: '#f6f4ff', dark: '#15131f' };

  /** Motyw systemu w przeglądarce. */
  const SYSTEM_DARK = '(prefers-color-scheme: dark)';
  /** Podpowiedź dla skryptu w <head> — bez niej przy starcie mruga jasny motyw. */
  const THEME_HINT_KEY = 'themeResolved';

  let current = null;
  const viewEl = $('#view');

  const ctx = { setTheme, resolveTheme, navigate };

  /* ------------------------- Motyw ------------------------- */

  function systemDark() {
    return !!(window.matchMedia && window.matchMedia(SYSTEM_DARK).matches);
  }

  /**
   * Ustawienie motywu → wariant do zastosowania.
   * „auto" (i wartości nieznane, np. zapisana w starszej wersji „sepia") idą za systemem,
   * jawny wybór użytkownika jest nadrzędny.
   */
  function resolveTheme(theme) {
    if (EXPLICIT_THEMES.includes(theme)) return theme;
    return systemDark() ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const resolved = resolveTheme(theme);
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved] || '#ffffff');
    try {
      localStorage.setItem(THEME_HINT_KEY, resolved);
    } catch (err) {
      /* np. tryb prywatny — podpowiedź jest tylko optymalizacją */
    }
    return resolved;
  }

  async function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    applyTheme(theme);
    await store.updateSettings({ theme });
  }

  /* ------------------------- Router ------------------------- */

  async function navigate(route, force = false) {
    if (!ROUTES[route]) route = 'home';
    if (route === current && !force) return;

    if (current && ROUTES[current].view.destroy) ROUTES[current].view.destroy();

    current = route;
    location.hash = route;
    document.title = `${ROUTES[route].title} — 3000 Words`;

    $$('.navbar__item').forEach((b) => b.classList.toggle('is-active', b.dataset.route === route));

    try {
      await ROUTES[route].view.render(viewEl, ctx);
    } catch (err) {
      console.error(err);
      viewEl.replaceChildren(
        html`<div class="empty">
          <div class="empty__icon">⚠️</div>
          <div class="empty__title">Coś poszło nie tak</div>
          <p class="empty__text">${err.message || 'Nie udało się wczytać widoku.'}</p>
        </div>`
      );
    }
  }

  /* ------------------------- Start ------------------------- */

  async function boot() {
    tts.init();

    try {
      await store.init();
    } catch (err) {
      console.error(err);
      toast('Nie udało się otworzyć lokalnej bazy danych');
    }

    applyTheme(store.settings().theme);

    // „Automatycznie": przełączenie trybu ciemnego w systemie od razu zmienia motyw aplikacji.
    window.matchMedia?.(SYSTEM_DARK).addEventListener('change', () => {
      const theme = store.settings().theme;
      if (!EXPLICIT_THEMES.includes(theme)) applyTheme(theme);
    });

    $$('.navbar__item').forEach((btn) => {
      btn.addEventListener('click', () => navigate(btn.dataset.route));
    });

    window.addEventListener('hashchange', () => {
      const route = location.hash.replace('#', '');
      if (route && route !== current) navigate(route);
    });

    const initial = location.hash.replace('#', '') || 'home';
    await navigate(initial);
  }

  boot();
})(window.App);
