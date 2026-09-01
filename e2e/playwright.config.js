// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Konfiguracja testów Playwright.
 * Aplikacja działa w pełni lokalnie (file://), więc testy nie potrzebują serwera.
 * Każdy test dostaje świeży, czysty profil przeglądarki (osobny IndexedDB).
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 390, height: 844 },
  },
});
