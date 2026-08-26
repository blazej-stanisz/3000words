window.App = window.App || {};
window.App.ui = (function (App) {
  'use strict';

  /** Drobne pomocniki UI. */

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /** Bezpieczne wstawianie tekstu do szablonu HTML. */
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Buduje fragment DOM z ciągu HTML. */
  function html(strings, ...vals) {
    const src = strings.reduce((acc, s, i) => acc + s + (vals[i] ?? ''), '');
    const tpl = document.createElement('template');
    tpl.innerHTML = src.trim();
    return tpl.content;
  }

  function render(container, node) {
    container.replaceChildren(node);
  }

  let toastTimer = null;
  function toast(message, ms = 2200) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), ms);
  }

  function loader(text = 'Wczytywanie…') {
    return html`<div class="loader"><div class="spinner"></div><span>${esc(text)}</span></div>`;
  }

  function speakerIcon() {
    return `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  }

  /** Pasek postępu. */
  function bar(pct, thin = false) {
    return `<div class="bar${thin ? ' bar--thin' : ''}"><div class="bar__fill" style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (n === 1) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function wordsLabel(n) {
    return plural(n, 'słowo', 'słowa', 'słów');
  }

  return { $, $$, esc, html, render, toast, loader, speakerIcon, bar, plural, wordsLabel };
})(window.App);
