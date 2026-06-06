# vtesItaly.Judge

Vademecum sanzioni VTES Italia — strumento consultabile da telefono per arbitri e giudici di tornei.

Sito statico (vanilla JS, GitHub Pages, PWA).

## Sviluppo locale

```bash
npm install
npm test            # unit + DOM smoke + schema gate + axe-core a11y
npm run lint        # eslint --max-warnings=0
npm run typecheck   # tsc --checkJs su core/app/sw + scripts/tests
npm run format      # prettier --write .
```

Per servire localmente:

```bash
./dev.sh            # macOS / Linux / Git Bash — http://localhost:8766
./dev.ps1           # Windows PowerShell, con menu start/stop/restart
```

Entrambi servono la cartella corrente con `python3 -m http.server` (richiesto Python 3).

### Pre-commit hook

Una volta per clone, attiva il gate locale che esegue `format:check`, `lint`,
`typecheck` e `npm test` prima di ogni commit:

```bash
git config core.hooksPath .githooks
```

Il file è in [`.githooks/pre-commit`](.githooks/pre-commit). Bypass con `git commit --no-verify` solo in casi
eccezionali — la stessa pipeline gira in CI e bloccherà il push.

## Sorgente dati

`data/vademecum.json` è la fonte canonica del vademecum (array di voci). Si edita
direttamente. Lo schema canonico è in [`data/vademecum.schema.json`](data/vademecum.schema.json) ed è validato
ad ogni `npm test` da [`tests/data.test.mjs`](tests/data.test.mjs) — voci malformate fanno fallire la CI.

Lo schema riflette la struttura della VEKN Judges' Guide (Definition, Example(s),
Philosophy, Penalty). Le label di sezione nella card riprendono letteralmente i
termini VEKN in inglese:

| Campo JSON    | UI label   | VEKN subsection | Note                                                  |
| ------------- | ---------- | --------------- | ----------------------------------------------------- |
| `description` | Definition | Definition      | Quando si verifica la fattispecie                     |
| `example`     | Example    | Example(s)      | Casistiche concrete a tavolino                        |
| `philosophy`  | Philosophy | Philosophy      | Razionale della regola                                |
| `sanction`    | _badge_    | Penalty (level) | Livello canonico (Caution / Warning / ...)            |
| `correzione`  | Penalty    | Penalty (prose) | Procedura correttiva contenuta nel subsection Penalty |

Schema per voce:

```json
{
  "category": "Categoria",
  "infraction": "Titolo dell'infrazione",
  "reference": "131",
  "sanction": "CAUTION",
  "description": "Quando si verifica la fattispecie",
  "example": "Casistiche concrete separate da '; '",
  "philosophy": "Razionale della regola",
  "correzione": "Cosa deve fare il giudice oltre alla sanzione"
}
```

- `sanction` può essere singola (`CAUTION`, `WARNING`, `GAME LOSS`, `DISQUALIFICATION`,
  `DISQUALIFICATION WITHOUT PRIZE`), un range fra due sanzioni canoniche con
  separatore (es. `CAUTION - GAME LOSS`), o un placeholder (`???` da definire,
  `///` caso particolare, `""` non specificato).
- `reference` accetta numero singolo (`131`), range (`141 - 162`), vuoto o `///`.
  Numeri noti vengono linkati alla [VEKN Judges' Guide](https://www.vekn.net/judges-guide)
  via Text Fragment (verificati 22/22 contro la pagina live).
- `description`, `example`, `philosophy`, `correzione` sono tutti campi obbligatori
  ma possono essere stringhe vuote. Le sezioni Definition/Example/Philosophy
  rendono solo se popolate; **Penalty** è sempre rendered — quando `correzione`
  è vuota mostra "Nessuna azione specifica oltre alla sanzione".
- L'unicità della coppia `(category, infraction)` è gatewata in CI: i duplicati
  fanno fallire la build (slug DOM e deep-link diventerebbero ambigui).

A runtime, voci malformate vengono scartate con `console.warn` e la pagina
continua a funzionare; un payload del tutto invalido mostra un messaggio di
errore esplicito al posto del caricamento.

## Build & deploy

CI in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) esegue tre job in sequenza per ogni push su `main` (e su PR, eccetto deploy):

1. **ci** — `npm audit --omit=dev --audit-level=moderate`, lint, format check, typecheck (`strict: true` in `tsconfig.json` since November 2026), test (unit + DOM + schema + a11y),
   stamp sw, stage in `_site/`, minify, budget 10MB
2. **lighthouse** — gate accessibilità (≥ 0.9), best-practices (≥ 0.9), SEO (≥ 0.9) come errori bloccanti; performance (≥ 0.7) come warning. Lighthouse esegue 3 run e prende il median per assorbire la varianza single-run (~±0.05).
3. **deploy** — pubblica `_site/` su GitHub Pages (solo su push, non su PR)

Concurrency `pages-${{ github.ref }}` è per-ref: una burst di PR Dependabot non si auto-cancella in coda.

Dominio: [judge.vtesitaly.com](https://judge.vtesitaly.com/) (CNAME).

## Struttura

- `index.html` + `assets/` — sorgenti del sito
- `assets/core.mjs` — logica pura DOM-free (testabile, type-checked) — vademecum **e** FAQ
- `assets/app.js` — bootstrap UI vademecum (eventi, render)
- `faq.html` + `assets/faq.js` — pagina FAQ card-centrica: per ogni carta, intestazione (nome) + immagine + testo verbatim + rulings ufficiali, e sotto un accordion di domande/risposte. Stesso shell cercabile (Ctrl+K, deep-link, offline) del vademecum
- `data/vademecum.json` — sorgente dati vademecum
- `data/vademecum.schema.json` — schema canonico (JSON Schema Draft-07)
- `data/faq.json` — sorgente dati FAQ: array di gruppi `{title, faqs[]}` con opzionali `image`, `text`, `url` (vdb.im) e `rulings[]` (`{text, source, url}`)
- `assets/cards/` — immagini carta servite localmente (CSP `img-src 'self'`, funzionano offline)
- `data/faq.schema.json` — schema canonico FAQ (JSON Schema Draft-07)
- `sw.js` + `manifest.webmanifest` — PWA. `NETWORK_TIMEOUT_MS = 12000` sulla strategia network-first: 12 s tollera qualche retransmit TCP su wifi torneo congestionato prima di fallback su cache, senza far percepire il sito "appeso" a tempo indefinito
- `scripts/` — staging, stamp-sw, minify, test runner
- `tests/`
  - `core.test.mjs` — moduli puri in `assets/core.mjs` (63 test: norm, escapeHtml, matchSearch, parseReference, parseSanction, highlightHtml — coperti edge case su match overlap, query lunghe e accent-folding multi-parola)
  - `data.test.mjs` — gate schema su `data/vademecum.json`, `data/judges.json` e `data/faq.json` (validità, unicità coppie e slug)
  - `dom.test.mjs` — smoke test end-to-end del vademecum via jsdom (render, eventi, hash routing, error UX)
  - `faq-dom.test.mjs` — smoke test end-to-end della pagina FAQ via jsdom (render, raggruppamento, ricerca, deep-link, error UX)
  - `a11y.test.mjs` — axe-core su DOM idratato (gate critical/serious WCAG 2.1 A/AA, escluso color-contrast che jsdom non valuta)
- `.githooks/pre-commit` — gate locale (vedi sopra)
- `tsconfig.json` — `checkJs` su tutto il codice JS

## Licenza

[MIT](LICENSE) — © 2026 VTES Italy.
