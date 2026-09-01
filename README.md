# 3000 Words — nauka angielskiego metodą przegródek

Aplikacja webowa do nauki 3000 najważniejszych angielskich słówek i zwrotów
z tłumaczeniami na polski i przykładami użycia. Bez backendu, bez logowania —
cały postęp zapisywany jest lokalnie w przeglądarce (IndexedDB).

## Uruchomienie
**Otwórz** https://blazej-stanisz.github.io/3000words/

### Skąd biorą się dane


Słownik trzymany jest w plikach JSON (`data/categories.json`,
`data/words/*.json`) i to one są źródłem prawdy. Gdy strona działa z `file://`,
przeglądarka blokuje `fetch` na plikach lokalnych, więc aplikacja sięga po
wygenerowany pakiet `data/bundle.js`.

**Po każdej zmianie w plikach JSON przebuduj pakiet:**

```bash
node tools/build-bundle.js
```

## Walidacja danych

Skrypt `tools/validate.ps1` sprawdza wszystkie pliki słownika: liczbę wpisów w każdej
kategorii, puste pola oraz duplikaty (lokalne i międzykategoryjne).

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\validate.ps1
```

## Jak to działa

### System przegródek (Leitner, 5 poziomów)

| Przegródka | Interwał powtórki |
|---|---|
| 1 — Nowe | codziennie |
| 2 — Świeże | co 2 dni |
| 3 — Znajome | co 4 dni |
| 4 — Utrwalone | co 8 dni |
| 5 — Prawie znane | co 16 dni |

- Poprawna odpowiedź przesuwa słowo o jedną przegródkę wyżej.
- Poprawna odpowiedź w przegródce 5 oznacza słowo jako **opanowane**.
- Błąd w przegródce 1–2 zostawia słowo w przegródce 1.
- Błąd w przegródce 3–5 cofa słowo o dwa poziomy (złagodzony reset — badania
  pokazują, że pełny reset do przegródki 1 zbyt mocno karze pojedyncze potknięcia).
- Słowo, które raz zawiodło w danej sesji, nie awansuje tego dnia, nawet jeśli
  za drugim razem zostanie rozpoznane.
- Terminy powtórek dostają losowy rozrzut ±10 %, żeby nie kumulowały się
  w jednym dniu.
- Słowo oznaczone „Znam" przy pierwszym kontakcie jest od razu zapisywane jako
  **opanowane** i nie wraca do nauki. W jego miejsce aplikacja dobiera nowe słowo,
  więc sesja kończy się dopiero, gdy limit nowych słów trafi do przegródki 1.
- Błędne karty wracają w tej samej sesji po 4 innych kartach (przeplatanie).

### Moduły

- **Start** — ekran powitalny przy pierwszym uruchomieniu, a gdy nauka już trwa:
  pierścień postępu, statystyki dnia, seria dni, wykres aktywności z 14 dni,
  rozkład przegródek, szybkie akcje i „słowo dnia" z lektorem.
- **Nauka** — wybór kategorii, triage nowych słówek (Tłumacz → Znam / Nie znam;
  „Znam" pomija słowo i dobiera nowe, sesja trwa, aż limit trafi do przegródek),
  następnie etap zapamiętywania słów nieznanych z lektorem, na końcu podsumowanie.
- **Powtórka** — inteligentnie dobrana kolejka zaległych słów (domyślnie do 25).
- **Postępy** — wykres opanowania, statystyki dzienne, seria dni, podział na kategorie.
- **Przegródki** — liczebność każdej przegródki i ile słów czeka na dziś.
- **Ustawienia** — rozmiar sesji, rozmiar powtórki, przykłady użycia, lektor
  (włączenie, automatyczne odtwarzanie, głos, tempo), motyw, reset postępów.

### Motywy

Jasny, sepia i ciemny — przełącznik w prawym górnym rogu lub w Ustawieniach.
Obok przełącznika motywu znajduje się skrót do Ustawień; dolny pasek zawiera
Start, Naukę, Powtórkę, Postępy i Przegródki.

### Lektor

Wykorzystuje wbudowane w przeglądarkę Web Speech API. Dostępność głosów
angielskich zależy od systemu operacyjnego i przeglądarki.

## Struktura projektu

```
index.html
css/
  themes.css        zmienne kolorystyczne trzech motywów
  main.css          layout i komponenty
js/
  app.js            router i bootstrap
  db.js             IndexedDB
  srs.js            silnik przegródek
  data.js           ładowanie słownika
  store.js          stan, ustawienia, statystyki
  tts.js            synteza mowy
  ui.js             pomocniki DOM
  views/            home, learn, review, stats, boxes, settings
data/
  categories.json   20 kategorii
  words/*.json      20 plików po 150 słówek
  bundle.js         wygenerowany pakiet danych (fallback dla file://)
tools/
  build-bundle.js   generator bundle.js
  validate.ps1      walidacja plików słownika
```

## Dane

3000 wpisów w 20 kategoriach tematycznych. Każdy wpis zawiera słowo angielskie,
polskie tłumaczenie oraz zdanie przykładowe z tłumaczeniem.

### Debugowanie w Chrome (testy automatyczne)

Aby umożliwić automatyzacji (np. browser-use) sterowanie Chrome przez CDP:

1. Uruchom Chrome z osobnym profilem i portem debugowania:

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\ChromeDebugProfile"
   ```

2. W otwartym Chrome wejdź na `chrome://inspect/#remote-debugging` i zaznacz
   **„Allow remote debugging for this browser instance"**.
3. Przy pierwszym połączeniu debuggera kliknij **Allow** w popupie.

Ustawienie zgody zapisuje się w profilu — wystarczy raz.
