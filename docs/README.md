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
│       ├── pages/           # Overview · Transactions · Budget · Import · Settings · Login
│       ├── components/      # charts · transactions · import · layout · common
│       ├── hooks/           # useTransactions · useSummary · useTimeline · useCategories · …
│       ├── api/             # wrapper fetch verso il backend
│       └── types/           # tipi condivisi + metadati categorie (colori/icone)
└── docs/                    # questa documentazione + migration SQL
```

L'autenticazione è gestita da Supabase Auth: il frontend ottiene un JWT al login, lo invia in `Authorization: Bearer <token>` su ogni richiesta, e il backend lo valida con `client.auth.get_user()` (`deps.get_current_user`). Tutti gli endpoint applicativi richiedono un token valido.

---

## Funzionalità

### Panoramica (Overview)
- KPI di periodo: entrate, spese, risparmio, saldo a fine periodo — con delta vs periodo precedente di pari lunghezza.
- Grafico andamento saldo cumulativo (`SaldoChart`).
- Grafico spese per categoria a barre (`SpendingBars`) con tooltip.
- Breakdown spese per categoria con possibilità di fissare categorie nel grafico.
- Selettore periodo a pill: questo mese · 3 mesi · 6 mesi · anno.

### Transazioni
- Lista paginata (50/pagina) con ricerca per descrizione, filtro per categoria e per intervallo date.
- Selettore periodo a pill + dropdown "Mese…" per scegliere un singolo mese tra gli ultimi 13.
- Ordinamento per data, importo, categoria o alfabetico (doppio click sulla pill attiva per reset).
- Creazione/modifica/eliminazione movimenti tramite drawer laterale.
- **Ricategorizzazione rapida**: assegnando una categoria a una transazione si crea/aggiorna una *regola utente* (`user_rules`) sulla descrizione, e tutte le transazioni con la stessa descrizione vengono aggiornate.
- **Split**: suddivisione di una transazione in più parti su categorie diverse (la somma delle parti deve coincidere con l'importo originale).

### Budget
- Riga KPI mensile: entrate · spese · risparmio.
- Selettore periodo (pill + dropdown mese) coerente con le altre pagine.
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
- Saldo iniziale del conto (base di tutti i calcoli di andamento) e valuta.
- **Gestione categorie** (sezione integrata, ex pagina Categorie): per ogni categoria di uscita si modificano le parole chiave e il **budget mensile**; per le entrate solo le parole chiave.
- Pulsante **"Ricategorizza tutto"**: riapplica la categorizzazione a tutte le transazioni usando le keyword del DB e le regole utente.

---

## Processi chiave

### Categorizzazione automatica
Implementata in `services/categorizer.py`. Ordine di precedenza nel determinare la categoria di un movimento:

1. **Stipendio** — se `amount > 600` (soglia `STIPENDIO_THRESHOLD`).
2. **Regole utente** (`user_rules`) — se la descrizione contiene un `pattern` salvato, vince la sua categoria.
3. **Entrate** (`amount > 0`) — match sulle keyword delle categorie income (Contanti, Rimborsi); altrimenti `Altro`.
4. **Uscite** (`amount < 0`) — match sulle keyword delle categorie expense; altrimenti `Altro`.

> **Sorgente delle keyword**: il **database è la fonte di verità**. Le `EXPENSE_RULES`/`INCOME_RULES` hardcoded servono solo come seed iniziale. Al primo `GET /categories` le categorie senza keyword nel DB vengono popolate (*lazy seed*) con i valori hardcoded. Tutte le chiamate a `categorize()` (import, ricategorizzazione) ricevono le keyword dal DB tramite il parametro `db_categories`.

### Importazione estratto conto
1. **`POST /import/preview`** — il file (CSV o XLSX) viene letto con pandas (`parser.parse_file_to_rows`). Vengono restituite colonne, prime 5 righe di esempio, tutte le righe grezze e un eventuale **profilo suggerito** (auto-detect tra Intesa Sanpaolo, UniCredit, Fineco in base ai nomi colonna).
2. **Mappatura colonne** — l'utente conferma/sceglie quali colonne sono data, descrizione e importo. Due formati supportati:
   - `single`: una sola colonna importo (segno incluso).
   - `dare_avere`: colonne separate per uscite (dare) ed entrate (avere).
   - Parsing robusto di date (7 formati IT/ISO) e importi (separatori `.`/`,`, simboli valuta, parentesi per negativi).
3. **`POST /import/confirm`** — le righe valide vengono mappate, **categorizzate** (regole utente + keyword DB) e **deduplicate**, poi inserite. Restituisce un report: importati, duplicati saltati, non categorizzati (`Altro`), errori.

### Deduplicazione
`services/deduplicator.py`: una transazione è considerata duplicata se coincide la tupla **(data, descrizione normalizzata lowercase, importo arrotondato a 2 decimali)**. Il controllo confronta sia con il DB (singola query sull'intervallo date del batch) sia all'interno dello stesso batch.

### Calcolo del saldo (timeline)
`GET /transactions/timeline` parte dal `saldo_iniziale` (impostazioni) e accumula **tutte** le transazioni fino a `to_date`, così il saldo a inizio periodo è corretto anche filtrando un intervallo. Granularità giorno/settimana/mese. Modalità `spending` per le sole uscite per categoria.

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
| POST | `/transactions` | Crea movimento |
| PUT | `/transactions/{id}` | Modifica (categoria, importo, nota, tag) |
| PATCH | `/transactions/{id}/category` | Imposta categoria + crea regola utente + propaga a stessa descrizione |
| DELETE | `/transactions/{id}` | Elimina (audit) |
| POST | `/transactions/{id}/split` | Suddivide in più parti |

### `/categories`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/categories` | Lista categorie (con lazy seed delle keyword) |
| POST | `/categories` | Crea categoria |
| PUT | `/categories/{id}` | Aggiorna keyword / colore / icona / budget |
| DELETE | `/categories/{id}` | Elimina |
| POST | `/categories/recategorize-all` | Riapplica categorizzazione a tutte le transazioni |

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
| PUT | `/settings/{key}` | Aggiorna valore (`saldo_iniziale`, `valuta`, `default_import_profile`) |

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
```

### Database
Eseguire una sola volta lo script [`docs/migration_v2.sql`](./migration_v2.sql) nel **SQL Editor di Supabase**. Crea le tabelle, gli indici e i seed delle categorie. Lo schema completo è documentato in [`docs/database_schema.md`](./database_schema.md).
