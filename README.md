# vtesItaly.Judge

Strumento per arbitri e giudici di tornei VTES Italia. Sito statico (vanilla JS, GitHub Pages).

Scaffold iniziale — il dominio applicativo del tool va ancora definito.

## Sviluppo locale

```bash
npm install
npm test
npm run lint
./dev.ps1   # serve la directory su http://localhost:8766
```

## Build & deploy

CI in `.github/workflows/deploy.yml` esegue tre job in sequenza per ogni push su `main`:

1. **ci** — lint, format check, test, stamp sw, stage in `_site/`, minify, budget
2. **lighthouse** — gate accessibilità (≥ 0.9) sull'artefatto `_site`
3. **deploy** — pubblica `_site/` su GitHub Pages

Dominio: [judge.vtesitaly.com](https://judge.vtesitaly.com/) (CNAME).

## Struttura

- `index.html` + `assets/` — sorgenti del sito
- `sw.js` + `manifest.webmanifest` — PWA
- `scripts/` — staging, stamp-sw, minify, test runner
- `tests/` — `node --test` su moduli puri in `assets/core.mjs`
