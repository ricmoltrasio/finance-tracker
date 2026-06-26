# Finance Tracker

Applicazione personale per il tracciamento delle finanze: importa estratti conto bancari, categorizza automaticamente i movimenti, monitora l'andamento del saldo e confronta le spese con budget mensili.

---

## Stack tecnologico

| Livello | Tecnologie |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite 5 · TailwindCSS 3 · React Query 5 · React Router 6 |
| **Backend** | FastAPI · Pydantic 2 · SlowAPI (rate limiting) · pandas + openpyxl (parsing file) |
| **Database / Auth** | Supabase (PostgreSQL + Supabase Auth via JWT) |
| **Grafici** | SVG custom renderizzati come data-URI (`SaldoChart`, `SpendingBars`) |

---

## Architettura

```
finance-tracker/
├── backend/                 # API FastAPI
│   ├── main.py              # app, CORS, registrazione router
│   ├── deps.py              # autenticazione (validazione JWT Supabase)
│   ├── limiter.py           # configurazione rate limiting
│   ├── db/supabase.py       # client Supabase
│   ├── models/              # modelli Pydantic (TransactionCreate/Update)
│   ├── routers/             # transactions · categories · import · settings
│   └── services/            # categorizer · parser · deduplicator · audit
├── frontend/                # SPA React
│   └── src/
│       ├── pages/           # Overview · Transactions · Budget · Import · Settings · Login · ResetPassword · NotFound
│       ├── components/      # charts · transactions · import · layout · common
│       ├── hooks/           # useTransactions · useSummary · useTimeline · useCategories · …
│       ├── api/             # wrapper fetch verso il backend
│       └── types/           # tipi condivisi + metadati categorie (colori/icone)
└── docs/                    # questa documentazione + migration SQL
```

L'autenticazione è gestita da Supabase Auth: il frontend ottiene un JWT al login, lo invia in `Authorization: Bearer <token>` su ogni richiesta, e il backend lo valida con `client.auth.get_user()` (`deps.get_current_user`). Tutti gli endpoint applicativi richiedono un token valido. Una risposta `401` causa logout automatico e redirect a `/login` (via `window.location.replace`).

---

## Funzionalità

### Panoramica (Overview)
- KPI di periodo: entrate, spese, risparmio, saldo a fine periodo — con delta vs periodo precedente di pari lunghezza.
- Grafico andamento saldo cumulativo (`SaldoChart`).
- Grafico spese per categoria a barre (`SpendingBars`) con tooltip.
- Breakdown spese per categoria con possibilità di fissare categorie nel grafico.
- Selettore periodo a pill: questo mese · 3 mesi · 6 mesi · 12 mesi · anno.
- **Transazioni eliminate**: accordion in fondo alla pagina che mostra i movimenti in soft-delete con possibilità di ripristino.

### Transazioni
- Scroll infinito (50 righe per pagina, caricamento automatico all'arrivo in fondo).
- Ricerca per descrizione, filtro per categoria e per intervallo date.
- Selettore periodo a pill + dropdown "Mese…" per scegliere un singolo mese tra gli ultimi 13.
- Ordinamento per data, importo, categoria o alfabetico (doppio click sulla pill attiva per reset).
- Creazione/modifica/eliminazione movimenti tramite drawer laterale.
- **Eliminazione soft**: i movimenti eliminati mantengono `deleted_at` nel DB (prevenzione re-import duplicati) e sono ripristinabili dalla Panoramica.
- **Ricategorizzazione con anteprima**: assegnando una categoria a una transazione (con propagazione attiva), viene mostrato un panel di riepilogo con la lista delle transazioni coinvolte e checkbox per deselezionare quelle da escludere. Confermando si crea/aggiorna la *regola utente* (`user_rules`) e si aggiornano solo le transazioni selezionate.
- **Split**: suddivisione di una transazione in più parti su categorie diverse (la somma delle parti deve coincidere con l'importo originale).

### Budget
- KPI di periodo: entrate · spese · risparmio.
- Selettore periodo (pill + dropdown mese) coerente con le altre pagine: questo mese · 3 mesi · 6 mesi · 12 mesi · anno.
- Card per categoria con barra di avanzamento speso/budget; colore della barra: verde < 75%, arancione 75–99%, rosso ≥ 100%.
- **Proiezioni di fine mese solo per Cibo e Auto**: `(speso / giorni trascorsi) × giorni del mese`. La proiezione diventa verde con `(-€X)` se sotto budget, rossa con `(+€X)` se sopra.
- I budget sono fissi (uguali ogni mese) e si impostano dalle Impostazioni.
- Barre e proiezioni sono mostrate solo in vista mese singolo (mese corrente o mese scelto dal dropdown).

### Importazione
Flusso a 3 step (vedi sezione *Processi*):
1. Upload file CSV/XLSX e anteprima.
2. Mappatura colonne (con auto-rilevamento del profilo banca).
3. Conferma con categorizzazione automatica e deduplicazione.

Supporta il salvataggio di **profili di import** per banca (mappatura colonne riutilizzabile).

### Impostazioni
- Saldo iniziale del conto (campo compatto, base di tutti i calcoli di andamento).
- **Gestione categorie**: per ogni categoria di uscita si modificano le parole chiave e il **budget mensile**; per le entrate solo le parole chiave.
- **"Solo Altro"**: anteprima dry-run + drawer di riepilogo → riapplica la categorizzazione alle sole transazioni ancora in categoria `Altro`.
- **"Ricategorizza tutto"**: stessa anteprima → riapplica a tutte le transazioni (sovrascrive anche le categorie già assegnate manualmente, eccetto le regole utente).

### Autenticazione
- Login con email e password.
- **Password dimenticata**: link visibile in caso di errore di login → invia email di reset via Supabase con redirect a `/reset-password`.
- **Reset password**: pagina dedicata (`/reset-password`) accessibile senza autenticazione; aggiorna la password e reindirizza alla home dopo 2 secondi.
- **401 auto-logout**: qualsiasi risposta `401` dal backend causa signOut Supabase e redirect a `/login`.

---

## Processi chiave

### Categorizzazione automatica
Implementata in `services/categorizer.py`. Ordine di precedenza nel determinare la categoria di un movimento:

1. **Stipendio** — se `amount > 600` (soglia `STIPENDIO_THRESHOLD`).
2. **Regole utente** (`user_rules`) — se la descrizione contiene un `pattern` salvato, vince la sua categoria.
3. **Entrate** (`amount > 0`) — match sulle keyword delle categorie income (Contanti, Rimborsi); altrimenti `Altro`.
4. **Uscite** (`amount < 0`) — match sulle keyword delle categorie expense; altrimenti `Altro`.

> **Sorgente delle keyword**: il **database è la fonte di verità**. Le `EXPENSE_RULES`/`INCOME_RULES` hardcoded servono solo come seed iniziale. Al primo `GET /categories` le categorie senza keyword nel DB vengono popolate (*lazy seed*) con i valori hardcoded. Tutte le chiamate a `categorize()` (import, ricategorizzazione) ricevono le keyword dal DB tramite il parametro `db_categories`.

### Soft delete
Le transazioni eliminate non vengono cancellate fisicamente: viene impostato `deleted_at TIMESTAMPTZ`. Questo garantisce che un file già importato non generi duplicati in futuro (il deduplicatore confronta anche con le righe soft-deleted). I movimenti eliminati sono ripristinabili dall'accordion "Transazioni eliminate" in Panoramica.

### Importazione estratto conto
1. **`POST /import/preview`** — il file (CSV o XLSX) viene letto con pandas (`parser.parse_file_to_rows`). Vengono restituite colonne, prime 5 righe di esempio, tutte le righe grezze e un eventuale **profilo suggerito** (auto-detect tra Intesa Sanpaolo, UniCredit, Fineco in base ai nomi colonna).
2. **Mappatura colonne** — l'utente conferma/sceglie quali colonne sono data, descrizione e importo. Due formati supportati:
   - `single`: una sola colonna importo (segno incluso).
   - `dare_avere`: colonne separate per uscite (dare) ed entrate (avere).
   - Parsing robusto di date (7 formati IT/ISO) e importi (separatori `.`/`,`, simboli valuta, parentesi per negativi).
3. **`POST /import/confirm`** — le righe valide vengono mappate, **categorizzate** (regole utente + keyword DB) e **deduplicate**, poi inserite. Restituisce un report: importati, duplicati saltati, non categorizzati (`Altro`), errori.

### Deduplicazione
`services/deduplicator.py`: una transazione è considerata duplicata se coincide la tupla **(data, descrizione normalizzata lowercase, importo arrotondato a 2 decimali)**. Il controllo confronta sia con il DB (incluse le righe soft-deleted) sia all'interno dello stesso batch.

### Calcolo del saldo (timeline)
`GET /transactions/timeline` parte dal `saldo_iniziale` (impostazioni) e accumula **tutte** le transazioni non eliminate fino a `to_date`, così il saldo a inizio periodo è corretto anche filtrando un intervallo. Granularità giorno/settimana/mese. Modalità `spending` per le sole uscite per categoria.

### Audit log
Azioni sensibili (eliminazione transazione, split, ricategorizzazione massiva, import completato, modifica categoria) vengono registrate in `audit_log` con utente, dettagli JSON e IP. Il logging non interrompe mai il flusso principale (fallisce silenziosamente).

---

## API (riepilogo endpoint)

Tutti gli endpoint richiedono `Authorization: Bearer <jwt>` e sono soggetti a rate limiting (SlowAPI).

### `/transactions`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/transactions` | Lista paginata + filtri (from, to, category, source, search, sort_by, sort_dir, limit, offset) |
| GET | `/transactions/summary` | Totali e aggregato per categoria su un intervallo |
| GET | `/transactions/timeline` | Saldo cumulativo / spese per bucket temporale |
| GET | `/transactions/deleted` | Lista transazioni in soft-delete |
| POST | `/transactions` | Crea movimento |
| PUT | `/transactions/{id}` | Modifica (categoria, importo, nota) |
| PATCH | `/transactions/{id}/category` | Imposta categoria; con `only_this=false` propaga a stessa descrizione e crea regola utente. Parametri: `dry_run` (anteprima senza salvare), `ids` (lista ID specifici da aggiornare) |
| PATCH | `/transactions/{id}/restore` | Ripristina transazione soft-deleted |
| DELETE | `/transactions/{id}` | Soft-delete (imposta `deleted_at`, audit log) |
| POST | `/transactions/{id}/split` | Suddivide in più parti |

### `/categories`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/categories` | Lista categorie (con lazy seed delle keyword) |
| POST | `/categories` | Crea categoria |
| PUT | `/categories/{id}` | Aggiorna keyword / colore / icona / budget |
| DELETE | `/categories/{id}` | Elimina |
| POST | `/categories/recategorize-all` | Riapplica categorizzazione a tutte le transazioni; `?dry_run=true` per anteprima |
| POST | `/categories/recategorize-uncategorized` | Come sopra ma solo sulle transazioni in categoria `Altro`; supporta `dry_run` |

### `/import`
| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/import/preview` | Anteprima file + profilo suggerito |
| POST | `/import/confirm` | Categorizza, deduplica e inserisce |
| GET/POST/PUT/DELETE | `/import/profiles[/{id}]` | CRUD profili di import |

### `/settings`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/settings` | Tutte le impostazioni (tipizzate) |
| PUT | `/settings/{key}` | Aggiorna valore (`saldo_iniziale`, `default_import_profile`) |

### Altro
- `GET /health` — healthcheck (no auth).
- `GET /docs` — documentazione interattiva OpenAPI.

---

## Avvio in locale

### Backend
```bash
cd backend
pip install -r requirements.txt
# Variabili d'ambiente richieste (es. file .env):
#   SUPABASE_URL, SUPABASE_KEY
#   ALLOWED_ORIGINS (opzionale, default localhost:3000 e :5173)
#   ENV=development|production
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # avvia Vite (default :5173)
npm run build        # type-check + build di produzione
npm run lint         # ESLint su src/
npm run type-check   # tsc --noEmit
```

### Qualità del codice
VSCode: `Ctrl+Shift+B` esegue il task **"Check tutto"** (`.vscode/tasks.json`) che lancia in parallelo lint e type-check di frontend e backend.

Per il backend installare i tool di sviluppo:
```bash
cd backend
pip install -r requirements-dev.txt
ruff check .                      # linter Python
mypy . --ignore-missing-imports   # type-check Python
```

### Database
Eseguire una sola volta lo script [`docs/migration_v2.sql`](./migration_v2.sql) nel **SQL Editor di Supabase**. Crea le tabelle, gli indici e i seed delle categorie. Lo schema completo è documentato in [`docs/database_schema.md`](./database_schema.md).

Per il soft-delete eseguire anche [`docs/migration_soft_delete.sql`](./migration_soft_delete.sql).
