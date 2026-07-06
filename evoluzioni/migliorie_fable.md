# Evolutive — Migliorie non funzionali

**Stato:** proposte, non implementate.
**Data:** luglio 2026.
**Origine:** revisione completa del codice (vedi `docs/assessment.md`, tutto risolto). Queste sono le migliorie *non funzionali* rimaste: affidabilità, operatività, performance. Nessuna tocca le feature.

---

## Priorità 1 — Backup dei dati ⚙️ QUASI FATTO (luglio 2026)

**L'unico rischio irreversibile rimasto.** La RLS protegge i dati da accessi esterni, ma non da un errore interno. Il piano free di Supabase **non ha backup automatici né point-in-time recovery**.

**Implementato** (vedi `docs/backup.md`):
- `backend/scripts/backup.py` — export completo in JSON (paginato, deterministico); primo backup eseguito.
- `backend/scripts/restore.py` — restore su progetto nuovo + SQL per le sequence.
- Workflow GitHub Actions settimanale pronto in `docs/backup.md`.

**Resta da fare (manuale, una tantum):** creare il repo privato `finance-tracker-backup`, aggiungere i 2 secrets, incollare il workflow e lanciare il primo run — passi esatti in `docs/backup.md`.

---

## Priorità 2 — CI minima prima dell'auto-deploy

Ogni push su `main` va **direttamente in produzione** (Railway + Vercel). Il frontend ha una rete implicita (il build Vercel esegue `tsc` e fallisce sugli errori di tipo), il backend **no**: un errore Python passa il build Docker e butta giù l'API, e lo si scopre solo aprendo l'app.

Fix: GitHub Action che a ogni push/PR esegue gli stessi check del task "Check tutto" locale:

```yaml
# .github/workflows/check.yml (bozza)
name: check
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: pip install -r backend/requirements-dev.txt
      - run: ruff check backend
      - run: mypy backend --ignore-missing-imports
      - run: python -m pytest backend/tests -q
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci --prefix frontend
      - run: npm run type-check --prefix frontend
      - run: npm run lint --prefix frontend
```

Nota: la CI **non blocca** il deploy Railway (che parte comunque al push) — serve come segnale immediato. Per bloccare davvero servirebbe lavorare su branch + PR con branch protection; per un progetto a sviluppatore singolo può bastare il segnale.

---

## ~~Regione Railway vicino a Supabase~~ ✅ FATTO (luglio 2026)

Il backend Railway è stato spostato da US West (California) a **europe-west4 (Amsterdam)**, vicino al progetto Supabase: eliminati ~150 ms di RTT transatlantico per ogni query.

---

## Priorità 3 — Monitoring leggero

Oggi se il backend muore lo si scopre usando l'app.

- **Minimo (consigliato):** ping gratuito su `/health` con UptimeRobot o simili → mail quando è giù. Setup: 5 minuti.
- **Gradino sopra (opzionale):** Sentry free tier per errori runtime frontend/backend. Per un'app a utente singolo probabilmente non necessario.

C'è già una sentinella nei log: il warning `_ALL_ROWS` (vedi assessment, B5) — quando comparirà nei log Railway sarà il momento di paginare summary/timeline.

---

## Priorità 4 — Pin delle dipendenze backend

`requirements.txt` usa `>=` senza lockfile: ogni deploy Railway può installare versioni mai testate (il vincolo `supabase<2.10` è la cicatrice di una rottura passata). Il frontend è già a posto (package-lock.json).

- Pinnare le versioni backend: `pip freeze` dall'ambiente funzionante → versioni esatte in `requirements.txt` (o file `constraints.txt`).
- Abilitare **Dependabot** sul repo GitHub per gli avvisi di sicurezza (frontend + backend + actions).

---

## Minori (annotate, nessuna urgenza)

| Cosa | Dettaglio | Giudizio |
|---|---|---|
| Warning ESLint in `Mappa.tsx` | `useEffect` con dipendenza `selected` mancante + setState nell'effect: mezzo bug latente. Se la sidebar città si comporta strana dopo un refetch, è lì. | Sistemare alla prossima occasione in cui si tocca la Mappa |
| Leaflet nel bundle principale | ~150 KB caricati anche per chi non apre la Mappa. `React.lazy` sulla route lo eliminerebbe. | Nicety, utile su mobile |
| Container Docker come root | Nessun utente non privilegiato nel Dockerfile. Su Railway l'impatto pratico è minimo. | Non prioritario |
| Test a livello API | Oggi i test coprono solo le funzioni pure (parser, categorizer). | Solo se il progetto cresce ancora; per il ritmo attuale il rapporto costo/beneficio non c'è |
| Altri warning ESLint (Settings, ToastContext, TransactionDrawer) | Cosmetici (setState-in-effect su form init, fast-refresh, watch di react-hook-form). | Ignorabili |

---

## Ordine consigliato

1. **Backup** subito (rischio irreversibile) — manuale oggi, endpoint di export appena possibile.
2. **CI** — mezz'ora, valore alto.
3. **UptimeRobot** su `/health` — 5 minuti.
4. **Pin dipendenze + Dependabot** — alla prossima sessione di manutenzione.
5. Minori — opportunisticamente, quando si tocca il file interessato.

*(Regione Railway → EU: ✅ fatta a luglio 2026.)*
