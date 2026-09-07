# Backup — Finance Tracker

Il piano free di Supabase **non ha backup automatici né point-in-time recovery**. Questo documento descrive il sistema di backup: uno script che esporta tutte le tabelle in JSON, eseguibile a mano in locale e automaticamente ogni settimana da un repo GitHub privato.

**Cosa protegge davvero**: i dati bancari sono ri-ottenibili (si riscarica l'estratto conto e lo si re-importa: la deduplicazione rende il re-import sicuro). Ciò che è insostituibile è il lavoro manuale — `user_rules`, correzioni di categoria/posizione, split, note, keyword e budget delle categorie. Per questo un backup **settimanale** è sufficiente.

---

## Componenti

| File | Scopo |
|---|---|
| `backend/scripts/backup.py` | Esporta le 8 tabelle in un unico `backup.json` (deterministico: diff git leggibili). Solo letture. Pagina a blocchi di 1000 righe (PostgREST tronca le risposte oltre max-rows). |
| `backend/scripts/restore.py` | Ripristina un `backup.json` su un progetto Supabase nuovo (dopo le migration). Stampa l'SQL per riallineare le sequence. |
| Repo privato `finance-tracker-backup` | Esegue `backup.py` ogni settimana via GitHub Actions e committa il dump: la storia git è la retention. |

> I dump **non stanno mai** nel repo pubblico dell'app: la cartella `backups/` è in `.gitignore`.

---

## Backup manuale (in locale)

```bash
cd backend
python scripts/backup.py            # scrive backend/backups/backup.json
```

Legge `SUPABASE_URL`/`SUPABASE_KEY` da `backend/.env`. Copiare il file su Drive.

---

## Backup automatico — setup del repo privato (una tantum)

1. Su GitHub: **New repository** → nome `finance-tracker-backup` → **Private** → spunta "Add a README" → Create.
2. Nel nuovo repo: **Settings → Secrets and variables → Actions → New repository secret**, due volte:
   - `SUPABASE_URL` = lo stesso valore impostato su Cloud Run
   - `SUPABASE_KEY` = la **service role key** (stessa di Cloud Run)
3. Nel nuovo repo: **Add file → Create new file** → percorso `.github/workflows/backup.yml` → incollare:

```yaml
name: backup

on:
  schedule:
    - cron: '0 3 * * 0'   # ogni domenica alle 03:00 UTC
  workflow_dispatch: {}    # esecuzione manuale dal tab Actions

permissions:
  contents: write

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo backup
        uses: actions/checkout@v4

      - name: Checkout codice app (repo pubblico)
        uses: actions/checkout@v4
        with:
          repository: ricmoltrasio/finance-tracker
          path: app

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - run: pip install supabase python-dotenv

      - name: Esegui backup
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: python app/backend/scripts/backup.py --out backups

      - name: Commit del dump
        run: |
          git config user.name "backup-bot"
          git config user.email "actions@users.noreply.github.com"
          git add backups
          git commit -m "backup $(date -u +%F)" || echo "nessun cambiamento"
          git push
```

4. **Test subito**: tab **Actions** → workflow "backup" → **Run workflow**. A fine run deve comparire il commit con `backups/backup.json` nel repo.
5. Da qui in poi gira da solo ogni domenica. La retention è la storia git: ogni versione del dump resta recuperabile (`git log -- backups/backup.json`).

> Nota: il workflow scarica il codice dal repo pubblico dell'app, quindi usa sempre l'ultima versione di `backup.py` senza duplicazioni. Se un giorno il repo dell'app diventasse privato, aggiungere un token al checkout (`with: token: ...`).

---

## Restore (disaster recovery)

Scenario: progetto Supabase perso o corrotto.

1. Creare un **nuovo progetto Supabase** (regione EU, come l'attuale).
2. Nel SQL Editor eseguire **tutte le migration** di `docs/` nell'ordine documentato nel [README](./README.md) (inclusa `migration_rls.sql`).
3. Recuperare l'ultimo `backup.json` (dal repo privato, o una versione precedente via `git log`).
4. In locale, puntare al **nuovo** progetto ed eseguire il restore:
   ```bash
   cd backend
   # attenzione: SUPABASE_URL/KEY del NUOVO progetto (env o .env temporaneo)
   python scripts/restore.py percorso/backup.json
   ```
   Lo script chiede conferma esplicita mostrando l'URL di destinazione.
5. Eseguire nel SQL Editor gli `setval(...)` che lo script stampa a fine restore (riallineano le sequence: senza, i prossimi insert collidono sugli id esistenti).
6. Aggiornare `SUPABASE_URL`/`SUPABASE_KEY` sul servizio Cloud Run (vedi [`deploy_cloudrun.md`](./deploy_cloudrun.md#4-variabili-dambiente)) e `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` su Vercel; ricreare l'utente in Supabase Auth (Authentication → Users).
7. Smoke test: login, transazioni, mappa.
