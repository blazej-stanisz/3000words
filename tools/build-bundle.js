/**
 * Generuje data/bundle.js na podstawie plikow JSON.
 * Bundle jest uzywany tylko wtedy, gdy strona dziala z file://
 * i przegladarka blokuje fetch. Na serwerze (np. GitHub Pages)
 * aplikacja czyta bezposrednio pliki JSON.
 *
 * Uruchomienie:  node tools/build-bundle.js
 */
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const categories = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8'));

const bundle = { categories };
for (const cat of categories) {
  const file = path.join(dataDir, 'words', `${cat.id}.json`);
  bundle[cat.id] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

const out = `/* Wygenerowane automatycznie przez tools/build-bundle.js - nie edytuj recznie. */\nwindow.WORDS_BUNDLE = ${JSON.stringify(bundle)};\n`;
const target = path.join(dataDir, 'bundle.js');
fs.writeFileSync(target, out, 'utf8');

const total = categories.reduce((n, c) => n + bundle[c.id].length, 0);
console.log(`bundle.js: ${categories.length} kategorii, ${total} slow, ${(out.length / 1024).toFixed(0)} KB`);
