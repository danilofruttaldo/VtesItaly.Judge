# vtesItaly.Judge

Vademecum sanzioni VTES Italia — strumento consultabile da telefono per arbitri e giudici di tornei.

Sito statico (vanilla JS, GitHub Pages, PWA).

## Sviluppo locale

```bash
npm install
npm test            # unit + DOM smoke + schema gate
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
Philosophy, Penalty). I campi narrativi rendono nella card nello stesso ordine
con le label italiane corrispondenti:

| Campo JSON    | UI label    | VEKN subsection | Note                                                  |
| ------------- | ----------- | --------------- | ----------------------------------------------------- |
| `description` | Definizione | Definition      | Quando si verifica la fattispecie                     |
| `example`     | Esempio     | Example(s)      | Casistiche concrete a tavolino                        |
| `philosophy`  | Filosofia   | Philosophy      | Razionale della regola                                |
| `sanction`    | _badge_     | Penalty (level) | Livello canonico, filtrabile                          |
| `correzione`  | Penalità    | Penalty (prose) | Procedura correttiva contenuta nel subsection Penalty |

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
  ma possono essere stringhe vuote. Le sezioni Definizione/Esempio/Filosofia
  rendono solo se popolate; **Penalità** è sempre rendered — quando `correzione`
  è vuota mostra "Nessuna azione specifica oltre alla sanzione".
- L'unicità della coppia `(category, infraction)` è gatewata in CI: i duplicati
  fanno fallire la build (slug DOM e deep-link diventerebbero ambigui).

A runtime, voci malformate vengono scartate con `console.warn` e la pagina
continua a funzionare; un payload del tutto invalido mostra un messaggio di
errore esplicito al posto del caricamento.

## Build & deploy

CI in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) esegue tre job in sequenza per ogni push su `main`:

1. **ci** — `npm audit`, lint, format check, typecheck, test (unit + DOM + schema),
   stamp sw, stage in `_site/`, minify, budget 10MB
2. **lighthouse** — gate accessibilità (≥ 0.9) sull'artefatto `_site`
3. **deploy** — pubblica `_site/` su GitHub Pages

Dominio: [judge.vtesitaly.com](https://judge.vtesitaly.com/) (CNAME).

## Struttura

- `index.html` + `assets/` — sorgenti del sito
- `assets/core.mjs` — logica pura DOM-free (testabile, type-checked)
- `assets/app.js` — bootstrap UI, eventi, render
- `data/vademecum.json` — sorgente dati
- `data/vademecum.schema.json` — schema canonico (JSON Schema Draft-07)
- `sw.js` + `manifest.webmanifest` — PWA
- `scripts/` — staging, stamp-sw, minify, test runner
- `tests/`
  - `core.test.mjs` — moduli puri in `assets/core.mjs`
  - `data.test.mjs` — gate schema su `data/vademecum.json`
  - `dom.test.mjs` — smoke test end-to-end via jsdom (render, eventi, hash routing, error UX)
- `.githooks/pre-commit` — gate locale (vedi sopra)
- `tsconfig.json` — `checkJs` su tutto il codice JS
