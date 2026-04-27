# vtesItaly.Judge

Vademecum sanzioni VTES Italia — strumento consultabile da telefono per arbitri e giudici di tornei.

Sito statico (vanilla JS, GitHub Pages, PWA).

## Sviluppo locale

```bash
npm install
npm test
npm run lint
./dev.ps1   # serve la directory su http://localhost:8766
```

## Sorgente dati

`data/vademecum.json` è la fonte canonica del vademecum (array di voci). Si edita
direttamente. Schema per voce:

```json
{
  "category": "Categoria",
  "infraction": "Descrizione dell'infrazione",
  "reference": "131",
  "sanction": "CAUTION",
  "notes": "Note e chiarimenti"
}
```

- `sanction` può essere singola (`CAUTION`, `WARNING`, `GAME LOSS`, `DISQUALIFICATION`,
  `DISQUALIFICATION WITHOUT PRIZE`), multipla con separatore (`CAUTION - GAME LOSS`),
  o placeholder (`???` da definire, `///` caso particolare).
- `reference` accetta numero singolo (`131`), range (`141 - 162`), o vuoto/`///`.
  Numeri noti vengono linkati alla [VEKN Judges' Guide](https://www.vekn.net/judges-guide)
  via Text Fragment.

## Build & deploy

CI in `.github/workflows/deploy.yml` esegue tre job in sequenza per ogni push su `main`:

1. **ci** — lint, format check, test, stamp sw, stage in `_site/`, minify, budget
2. **lighthouse** — gate accessibilità (≥ 0.9) sull'artefatto `_site`
3. **deploy** — pubblica `_site/` su GitHub Pages

Dominio: [judge.vtesitaly.com](https://judge.vtesitaly.com/) (CNAME).

## Struttura

- `index.html` + `assets/` — sorgenti del sito
- `data/vademecum.json` — sorgente dati
- `sw.js` + `manifest.webmanifest` — PWA
- `scripts/` — staging, stamp-sw, minify, test runner
- `tests/` — `node --test` su moduli puri in `assets/core.mjs`
