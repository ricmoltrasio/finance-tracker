# Finance Tracker

Applicazione personale per il tracciamento delle finanze: importa estratti conto bancari, categorizza automaticamente i movimenti, monitora l'andamento del saldo e confronta le spese con budget mensili. Include una mappa delle spese geolocalizzate per città.

---

## Stack tecnologico

| Livello | Tecnologie |
|---|---|
| **Frontend** | React 18 · TypeScript · Vite 5 · TailwindCSS 3 · React Query 5 · React Router 6 |
| **Backend** | FastAPI · Pydantic 2 · SlowAPI (rate limiting) · pandas + openpyxl (parsing file) |
| **Database / Auth** | Supabase (PostgreSQL + Supabase Auth via JWT) |
| **Grafici** | SVG custom renderizzati come data-URI (`SaldoChart`, `SpendingBars`) |
| **Mappa** | Leaflet + `leaflet.markercluster` · CartoDB Voyager tiles · geocoder OSM (gazetteer locale + Nominatim) |

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
│   ├── routers/             # transactions · categories · import · settings · locations
│   ├── services/            # categorizer · parser · deduplicator · audit · geocoder
│   └── data/comuni.json     # gazetteer statico (173 comuni/capoluoghi)
├── frontend/                # SPA React
│   └── src/
│       ├── pages/           # Overview · Transactions · Budget · Import · Settings · Mappa · Login · ResetPassword · NotFound
│       ├── components/      # charts · transactions · import · layout · common (incl. MobileSheet)
│       ├── hooks/           # useTransactions · useSummary · useTimeline · useCategories · useIsMobile · …
│       ├── api/             # wrapper fetch verso il backend (incl. locationsApi)
│       └── types/           # tipi condivisi + metadati categorie (colori/icone)
└── docs/                    # questa documentazione + migration SQL
```

L'autenticazione è gestita da Supabase Auth: il frontend ottiene un JWT al login, lo invia in `Authorization: Bearer <token>` su ogni richiesta, e il backend lo valida con `client.auth.get_user()` (`deps.get_current_user`). Tutti gli endpoint applicativi richiedono un token valido. Una risposta `401` causa logout automatico e redirect a `/login` (via `window.location.replace`).

### Caricamento (skeleton)

Il backend gira su Cloud Run scale-to-zero: al primo caricamento di una pagina dopo un periodo di inattività il cold start può richiedere diversi secondi. Ogni pagina/lista mostra in quell'attesa uno skeleton che ricalca la forma reale del contenuto (`components/skeletons/`, primitiva `components/common/Skeleton.tsx`, shimmer CSS `.skeleton` in `index.css`) invece di uno spinner generico — riusando le classi CSS reali della pagina, il comportamento responsive mobile è automatico. Vale solo per il primo caricamento (`isLoading` di React Query, nessun dato in cache): paginazione, azioni in corso e il check sessione restano con lo spinner esistente. Dettagli in `evoluzioni/done_skeleton_loading.md`.

### Adattamento mobile

Breakpoint `@media (max-width: 640px)` separato dall'attuale `860px` (sidebar→bottomnav). Su mobile:
- Hook `useIsMobile()` (basato su `matchMedia`) per rami JSX strutturalmente diversi (il ramo desktop resta invariato).
- `MobileSheet` — componente bottom sheet che riusa `.drawer`/`.drawer-scrim` (già ri-stilati come foglio dal basso a ≤640px) con drag handle, scrim e animazione `sheetUp`.
- I drawer laterali diventano automaticamente bottom sheet a ≤640px via CSS, senza modifiche JS.
- Le pagine **Transazioni** e **Mappa** hanno un foglio "Filtri" dedicato (filtri collassati dietro un pulsante, si aprono come bottom sheet) per non coprire il contenuto principale con i controlli.
- **Panoramica** e **Budget** usano il selettore periodo collassato `PeriodChip` (chip + popover) al posto della fila di pill; KPI reimpaginati a griglia (2+1).
- I grafici (`SaldoChart`, `SpendingBars`) hanno handler touch additivi rispetto a quelli mouse; su mobile il pin-multiplo delle categorie in Panoramica è disattivato (resta il drill singolo al tap).
- **Importazione**: anteprima tabella con scroll orizzontale isolato; nel report il dettaglio delle righe si apre in un `MobileSheet`.

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
- **Filtro esercenti (parziali per luogo di spesa)**: doppio click su una transazione (pressione prolungata su mobile) aggiunge/rimuove il suo esercente (descrizione esatta) dal filtro della pagina. Con selezione attiva compare una barra chip (✕ per rimuovere, "Azzera") e una riga parziale con movimenti/spese/entrate della selezione, calcolata dal backend con gli stessi filtri attivi. Disponibile anche in Budget (KPI e card filtrati, gesto nel drill categoria) e Mappa (marker e statistiche filtrati); la selezione è per-pagina e persiste in sessione.
- **Chip posizione**: quando una transazione ha una città associata, nella riga compare un chip 📍 cliccabile.
- **Correzione posizione**: dal drawer di modifica transazione è possibile impostare/correggere la città, con anteprima `dry_run` e scelta "solo questa transazione" / "tutte le transazioni dello stesso esercente".

### Budget
- KPI di periodo: entrate · spese · risparmio.
- Selettore periodo (pill + dropdown mese) coerente con le altre pagine: questo mese · 3 mesi · 6 mesi · 12 mesi · anno.
- Card per categoria con barra di avanzamento speso/budget; colore della barra: verde < 75%, arancione 75–99%, rosso ≥ 100%.
- **Proiezioni di fine mese solo per Cibo e Auto**: `(speso / giorni trascorsi) × giorni del mese`. La proiezione diventa verde con `(-€X)` se sotto budget, rossa con `(+€X)` se sopra.
- I budget sono fissi (uguali ogni mese) e si impostano dalle Impostazioni.
- Barre e proiezioni sono mostrate solo in vista mese singolo (mese corrente o mese scelto dal dropdown).

### Mappa
Pagina dedicata alla visualizzazione geografica delle **sole spese** (importi negativi) sul periodo selezionato.

- Mappa Leaflet con tile CartoDB Voyager; cluster dei marker per punti vicini (conteggio transazioni).
- Su desktop: tap/click su un cluster o marker → sidebar laterale con statistiche città (n. transazioni, totale spese) e lista transazioni ordinate per data, ciascuna con `CatGlyph` + categoria colorata.
- Su mobile: stesso contenuto in un **bottom sheet** che sale dal basso; i filtri (periodo + mese specifico) si aprono in un secondo sheet separato per non coprire la mappa.
- Tooltip permanente su ogni marker su mobile (su desktop appare solo su hover): mostra città e totale spese.
- **Correzione posizione** dalla lista transazioni della sidebar → apre l'`EditDrawer` (embedded su desktop, overlay su mobile).
- **"Arricchisci posizioni"**: geocodifica retroattiva di tutte le descrizioni ancora assenti da `merchant_locations`; il risultato è mostrato in header (desktop) o via toast (mobile).
- Selettore periodo condiviso (Questo mese · 3m · 6m · 12m · Quest'anno) + selettore mese specifico, coerenti con le altre pagine.

#### Come arriva la posizione

La geocodifica avviene sulla **descrizione della transazione** (es. `"Penny Market Monza"`, `"Coop Saronno VA"`), non su una colonna luogo separata. Pipeline in `services/geocoder.py` → vedi sezione *Geocodifica* nei Processi chiave.

Le posizioni sono salvate in due livelli:
- `merchant_locations` — lookup per descrizione normalizzata, condiviso tra tutte le transazioni dello stesso esercente (`source='auto'` o `'manual'`).
- `transactions.loc_city / loc_lat / loc_lng` — override per singola transazione (o per gruppo), impostato dalla correzione manuale nel drawer. Ha priorità su `merchant_locations`.

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
- **Sessione persistente**: Supabase salva la sessione in `localStorage` con refresh token (30 giorni); l'app non chiede ri-login a ogni apertura, inclusa la PWA installata.

---

## Processi chiave

### Categorizzazione automatica
Implementata in `services/categorizer.py`. Ordine di precedenza nel determinare la categoria di un movimento:

1. **Regole utente** (`user_rules`) — se la descrizione contiene un `pattern` salvato, vince la sua categoria (priorità assoluta, anche sulla soglia stipendio).
2. **Stipendio** — se `amount > 600` (soglia `STIPENDIO_THRESHOLD`).
3. **Entrate** (`amount > 0`) — match sulle keyword delle categorie income (Contanti, Rimborsi); altrimenti `Altro`.
4. **Uscite** (`amount < 0`) — match sulle keyword delle categorie expense; altrimenti `Altro`.

> **Sorgente delle keyword**: il **database è la fonte di verità**, sia per le uscite che per le entrate. Le `EXPENSE_RULES`/`INCOME_RULES` hardcoded servono solo come seed iniziale. Al primo `GET /categories` le categorie senza keyword nel DB vengono popolate (*lazy seed*) con i valori hardcoded. Tutte le chiamate a `categorize()` (import, ricategorizzazione) ricevono le keyword dal DB (`db_categories` + `db_income_categories`). Le categorie create dall'utente vengono considerate nel matching, in coda a quelle predefinite (l'ordine hardcoded decide chi vince sui match ambigui, es. "autostrada" → Auto prima di Spostamenti).

### Geocodifica
Implementata in `services/geocoder.py`. Estrae la città dalla descrizione della transazione e la risolve in coordinate.

1. **Pulizia sigla provincia**: rimuove l'eventuale sigla finale se è un token separato (`"Saronno VA"` → `"Saronno"`, `"Milano (MI)"` → `"Milano"`). Non tocca le ultime lettere di una parola singola (es. `"Lainate"` resta intatta).
2. **Esclusione falsi positivi**: candidati noti come ambigui (es. `"Milan"` in inglese, frequente in abbonamenti esteri, che Nominatim risolverebbe come Milano) sono ignorati. `"Milano"` in italiano resta valido.
3. **Gazetteer locale** (`data/comuni.json`, 173 comuni/capoluoghi principali): lookup istantaneo, nessuna rete.
4. **Fallback Nominatim** (OSM): per comuni non presenti nel gazetteer, query con throttle a 1 req/s e cache in-process (`lru_cache`). Limitato a `countrycodes=it` — le città estere non vengono risolte.

La geocodifica avviene **per esercente** (per `description` normalizzata), non per singola transazione: una descrizione risolta una volta popola `merchant_locations` e vale per tutti i movimenti futuri con la stessa descrizione.

`POST /locations/enrich` riesegue la geocodifica solo sulle descrizioni **ancora assenti** da `merchant_locations`. Per forzare un ricalcolo completo (es. dopo un fix al geocoder) eseguire `docs/reset_locations.sql` nel SQL Editor di Supabase.

> `enrich_with_overpass()` (precisione a livello POI via Overpass API) è scritta ma non collegata ad alcun endpoint — la posizione resta al centroide del comune.

### Soft delete
Le transazioni eliminate non vengono cancellate fisicamente: viene impostato `deleted_at TIMESTAMPTZ`. Questo garantisce che un file già importato non generi duplicati in futuro (il deduplicatore confronta anche con le righe soft-deleted). I movimenti eliminati sono ripristinabili dall'accordion "Transazioni eliminate" in Panoramica.

### Importazione estratto conto
1. **`POST /import/preview`** — il file (CSV o XLSX) viene letto con pandas (`parser.parse_file_to_rows`). Vengono restituite colonne, prime 5 righe di esempio, tutte le righe grezze e un eventuale **profilo suggerito** (auto-detect tra Intesa Sanpaolo, UniCredit, Fineco in base ai nomi colonna).
2. **Mappatura colonne** — l'utente conferma/sceglie quali colonne sono data, descrizione e importo. Due formati supportati:
   - `single`: una sola colonna importo (segno incluso).
   - `dare_avere`: colonne separate per uscite (dare) ed entrate (avere).
   - Parsing robusto di date (7 formati IT/ISO) e importi (separatori `.`/`,`, simboli valuta, parentesi per negativi).
3. **`POST /import/confirm`** — le righe valide vengono mappate, **categorizzate** (regole utente + keyword DB) e **deduplicate**, poi inserite. Restituisce un report: importati, duplicati saltati, non categorizzati (`Altro`), errori. La geocodifica avviene contestualmente sulla descrizione di ogni riga.

### Deduplicazione
`services/deduplicator.py`: una transazione è considerata duplicata se coincide la tupla **(data, descrizione normalizzata lowercase, importo arrotondato a 2 decimali)**. Il controllo confronta sia con il DB (incluse le righe soft-deleted) sia all'interno dello stesso batch.

Per le righe del DB l'importo confrontato è **`orig_amount`** (congelato all'inserimento, mai aggiornato): se modifichi a mano l'importo di una transazione importata, il re-import dello stesso file **non** reinserisce l'originale. Quando l'importo corrente differisce dall'originale, il drawer di modifica mostra "originale: €X" sotto il campo importo.

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
| GET | `/transactions` | Lista paginata + filtri (from, to, category, source, search, `descriptions` ripetibile, sort_by, sort_dir, limit, offset) |
| GET | `/transactions/summary` | Totali e aggregato per categoria su un intervallo; filtri opzionali `category`, `search`, `descriptions` (ripetibile) |
| GET | `/transactions/timeline` | Saldo cumulativo / spese per bucket temporale |
| GET | `/transactions/deleted` | Lista transazioni in soft-delete |
| POST | `/transactions` | Crea movimento |
| PUT | `/transactions/{id}` | Modifica (categoria, importo, nota) |
| PATCH | `/transactions/{id}/category` | Imposta categoria; con `only_this=false` propaga a stessa descrizione e crea regola utente. Parametri: `dry_run` (anteprima senza salvare), `ids` (lista ID specifici da aggiornare) |
| PUT | `/transactions/{id}/location` | Imposta/corregge la città della transazione. Body: `{ city, only_this }`. Con `only_this=false` aggiorna `merchant_locations` (tutte le transazioni dello stesso esercente). Supporta `dry_run` per anteprima. |
| PATCH | `/transactions/{id}/restore` | Ripristina transazione soft-deleted |
| DELETE | `/transactions/{id}` | Soft-delete (imposta `deleted_at`, audit log) |
| POST | `/transactions/{id}/split` | Suddivide in più parti |

### `/locations`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/locations/map` | Spese geolocalizzate del periodo (`?from=&to=` + `descriptions` ripetibile), aggregate per città. Solo transazioni con `amount < 0`. |
| POST | `/locations/enrich` | Geocodifica retroattiva bulk: processa le descrizioni ancora assenti da `merchant_locations`. |

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
| POST | `/import/confirm` | Categorizza, deduplica, geocodifica e inserisce |
| GET/POST/PUT/DELETE | `/import/profiles[/{id}]` | CRUD profili di import |

### `/settings`
| Metodo | Path | Descrizione |
|---|---|---|
| GET | `/settings` | Tutte le impostazioni (tipizzate) |
| PUT | `/settings/{key}` | Aggiorna valore (`saldo_iniziale`, `default_import_profile`) |

### Altro
- `GET /health` — healthcheck (no auth).
- `GET /docs` — documentazione interattiva OpenAPI (solo in development: con `ENV=production` è disattivata insieme a `/redoc` e `/openapi.json`).

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

Per la deduplicazione robusta alle modifiche manuali eseguire [`docs/migration_orig_amount.sql`](./migration_orig_amount.sql).

Per la mappa eseguire [`docs/migration_merchant_locations.sql`](./migration_merchant_locations.sql) e [`docs/migration_transaction_location_override.sql`](./migration_transaction_location_override.sql).

Per la sicurezza eseguire [`docs/migration_rls.sql`](./migration_rls.sql): abilita la RLS su tutte le tabelle senza policy, così l'API REST di Supabase (anon key, esposta nel bundle frontend) non può accedere ai dati — solo il backend (service role) può.

Per azzerare tutte le posizioni e forzare un ricalcolo completo (es. dopo un fix al geocoder): [`docs/reset_locations.sql`](./reset_locations.sql).

### Backup

Backup automatico settimanale del DB (il free tier Supabase non ne ha): script `backend/scripts/backup.py` eseguito ogni domenica da un repo GitHub privato, con restore documentato. Tutto in [`docs/backup.md`](./backup.md).
