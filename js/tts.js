window.App = window.App || {};
window.App.tts = (function (App) {
  'use strict';

  /**
   * Lektor - Web Speech API (speechSynthesis).
   * Brak wsparcia w przeglądarce nie blokuje działania aplikacji.
   */

  let voices = [];
  let ready = false;
  let preferredVoiceURI = null;
  let rate = 0.9;
  let enabled = true;

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  function loadVoices() {
    if (!supported) return [];
    voices = window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
    ready = voices.length > 0;
    return voices;
  }

  function init() {
    if (!supported) return;
    loadVoices();
    window.speechSynthesis.onvoiceschanged = () => loadVoices();
  }

  function getVoices() {
    if (!ready) loadVoices();
    return voices;
  }

  function configure({ voiceURI, rate: r, enabled: e } = {}) {
    if (voiceURI !== undefined) preferredVoiceURI = voiceURI;
    if (r !== undefined) rate = r;
    if (e !== undefined) enabled = e;
  }

  function pickVoice() {
    const list = getVoices();
    if (!list.length) return null;
    if (preferredVoiceURI) {
      const found = list.find((v) => v.voiceURI === preferredVoiceURI);
      if (found) return found;
    }
    return (
      list.find((v) => /en-GB/i.test(v.lang)) ||
      list.find((v) => /en-US/i.test(v.lang)) ||
      list[0]
    );
  }

  function cancel() {
    if (supported) window.speechSynthesis.cancel();
  }

  /**
   * Wypowiada tekst po angielsku.
   * @returns {Promise<void>} rozwiązywana po zakończeniu (lub natychmiast, gdy brak wsparcia)
   */
  function speak(text, { force = false } = {}) {
    if (!supported || !text) return Promise.resolve();
    if (!enabled && !force) return Promise.resolve();

    cancel();

    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else {
        u.lang = 'en-GB';
      }
      u.rate = rate;
      u.pitch = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
      // Zabezpieczenie: niektóre przeglądarki gubią zdarzenie onend.
      setTimeout(resolve, Math.min(8000, 1500 + text.length * 90));
    });
  }

  return { supported, init, getVoices, configure, cancel, speak };
})(window.App);
