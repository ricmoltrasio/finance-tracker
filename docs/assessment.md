# Assessment — Finance Tracker

**Data:** luglio 2026.
**Scope:** revisione completa di struttura, dead code, sviste funzionali e security su tutto il repo (backend, frontend, migration, config di deploy). Contesto: app per uso personale, l'unico utente è lo sviluppatore.

**Verifiche automatiche eseguite:** 26 test backend passati · `ruff check` pulito · `mypy` pulito · `tsc --noEmit` pulito.

**Verdetto generale:** codice in salute, architettura giusta (router/services separati, modelli Pydantic, keyword centralizzate, frontend ordinato in pages/components/hooks/api). **Nessuna ristrutturazione grossa necessaria.** Un punto di security serio (RLS), alcuni bug funzionali reali nel categorizer, un appunto strutturale sull'event loop e un po' di zavorra nel repo.

---

## 🔴 Security

### S1 — Nessuna RLS sulle tabelle (il punto serio) ✅ RISOLTO

> Risolto (luglio 2026): eseguita `docs/migration_rls.sql` nel SQL Editor di Supabase.

Le migration (`migration_v2.sql` e successive) non abilitano mai la Row Level Security. Su Supabase le tabelle nello schema `public` sono esposte via API REST (PostgREST), e la **anon key sta nel bundle JS pubblico** su Vercel — chiunque apra i DevTools la trova. Senza RLS, con anon key + URL Supabase si possono **leggere e scrivere tutte le tabelle direttamente**, bypassando completamente il backend e la sua autenticazione: transazioni, saldo, audit log, tutto.

**Fix (indolore):** una migration che fa `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` su tutte le 7 tabelle (`transactions`, `categories`, `split_items`, `import_profiles`, `settings`, `user_rules`, `audit_log`, più `merchant_locations`) **senza aggiungere alcuna policy**. Il backend usa la service role key che bypassa la RLS → non cambia nulla per l'app; il frontend usa Supabase solo per l'auth, mai per i dati → non si rompe nulla. È il fix a più alto rapporto beneficio/costo di tutta la lista.

> Da verificare prima nel dashboard Supabase: **Database → Tables → colonna RLS**. Se la RLS fosse già stata abilitata a mano, questo punto decade.

### S2 — `ENV=production` non impostato su Railway ✅ NON SUSSISTE

> Verificato (luglio 2026): la variabile era già impostata su Railway. La segnalazione nasceva dal fatto che `deploy.md` non la elencava (la impostava solo il `fly.toml` morto).

### S3 — Rate limiting e IP audit dietro proxy ✅ RISOLTO

Uvicorn partiva senza `--proxy-headers` (`backend/Dockerfile`), quindi `request.client.host` era l'IP del proxy Railway, non del client: tutti i limiti slowapi condividevano un unico bucket e l'IP nell'audit log era sempre quello interno.

> Risolto (luglio 2026): aggiunti `--proxy-headers --forwarded-allow-ips "*"` al CMD del Dockerfile.

### S4 — `/docs` (Swagger) pubblico senza auth ✅ RISOLTO

Esponeva lo schema API a chiunque (gli endpoint restavano comunque protetti).

> Risolto (luglio 2026): con `ENV=production`, `docs_url`/`redoc_url`/`openapi_url` sono disattivati in `main.py`. In development restano attivi.

### Verificato e a posto

- JWT validato su ogni richiesta con cache 60 s documentata (`deps.py`) — tradeoff accettabile e dichiarato.
- Nessun `dangerouslySetInnerHTML`; l'unico HTML template è il tooltip Leaflet in `Mappa.tsx` con dati propri.
- `.gitignore` corretto sui `.env`; nessun segreto committato.
- Upload limitato a 10 MB; validazioni input sensate (descrizione vuota, importo zero, settings tipizzate).
- Audit log best-effort ma con logging del fallimento.

---

## 🟠 Bug e sviste funzionali

### B1 — Keyword delle categorie entrata dal DB ignorate ✅ RISOLTO

> Risolto (luglio 2026): `load_db_categories()` ora restituisce anche le categorie entrata e `categorize()` le usa (`db_income_categories`).

`categorize()` (`services/categorizer.py`) itera `INCOME_RULES` hardcoded; `load_db_categories()` (`services/category_keywords.py`) esclude esplicitamente le categorie income. Quindi modificare le keyword di Contanti/Rimborsi dalle Impostazioni **non ha alcun effetto**, mentre il README dichiara il contrario ("per le entrate solo le parole chiave").

### B2 — Le categorie nuove create dall'utente non vengono mai matchate ✅ RISOLTO

> Risolto (luglio 2026): `_merge_rules()` in `categorizer.py` accoda le categorie presenti solo nel DB alle hardcoded (che mantengono la precedenza sui match ambigui).

Sempre in `categorize()`, il loop spese itera i nomi di `EXPENSE_RULES` hardcoded: una categoria creata via `POST /categories` con le sue keyword esiste nel DB ma il categorizzatore non la considererà mai. Oggi non morde (si usano le 13 seed), ma è una trappola silenziosa.

### B3 — Soglia stipendio prima delle regole utente ✅ RISOLTO

> Risolto (luglio 2026): le user rules ora hanno priorità assoluta, anche sulla soglia stipendio. Documentazione aggiornata (README + database_schema).

`amount > 600` → Stipendio vince su tutto, anche su una user rule esplicita: un rimborso da 700 € finirà sempre in Stipendio e non c'è modo di correggerlo in modo persistente. Basterebbe spostare il check dopo le user rules.

### B4 — Split non atomico e modificabile a posteriori ✅ RISOLTO

> Risolto (luglio 2026): ordine invertito (prima le parti, poi il flag `is_split`, con cleanup delle parti se il flag fallisce); `PUT /transactions/{id}` rifiuta la modifica dell'importo di una transazione divisa (400).

In `split_transaction` si setta `is_split=True` e *poi* si inseriscono le parti: se il secondo insert fallisce resta una transazione "divisa" senza parti (Supabase REST non ha transazioni SQL). Inoltre `PUT /transactions/{id}` permette di cambiare l'`amount` di una transazione già splittata senza ricontrollare la somma delle parti.

### B5 — Tetto `_ALL_ROWS = 10.000` silenzioso sul saldo ✅ MITIGATO

Timeline e summary caricano al massimo 10k righe: superata la soglia (qualche anno di dati), il saldo cumulativo diventa **sbagliato senza alcun segnale**.

> Mitigato (luglio 2026): `_warn_if_capped()` logga un warning quando summary/timeline raggiungono il tetto. Il limite resta 10k: quando il warning comparirà nei log di Railway sarà il momento di paginare o alzare.

### B6 — Minori ✅ RISOLTI

- `set_category`/`set_location` con `ids` espliciti non filtravano `deleted_at` → aggiunto il filtro.
- Il parser dichiarava supporto `.xls` ma `xlrd` non è nei requirements → ora `.xls` è rifiutato con messaggio chiaro (422) e il DropZone non lo accetta più; supportati `.xlsx` e CSV.
- `restore` e `DELETE /categories` non erano auditati → aggiunti `RESTORE_TRANSACTION` e `CATEGORY_DELETED` (con 404 sulla delete di categoria inesistente).

---

## 🟡 Struttura — un solo appunto vero

### Endpoint `async def` + client sincrono = event loop bloccato ✅ RISOLTO

> Risolto (luglio 2026): tutti gli endpoint dei router, `get_current_user` e `audit.log` sono ora `def` sincroni — FastAPI li esegue nel threadpool, quindi le chiamate bloccanti (Supabase, Nominatim, `time.sleep`) non fermano più l'event loop. `/health` resta servito anche durante un enrich lungo. Verificato con smoke test in-process (health 200, auth guard 401, docs 404 con `ENV=production`).

Tutti gli endpoint sono `async` ma usano il client Supabase sincrono, httpx sincrono e perfino `time.sleep` nel throttle Nominatim (`geocoder.py`). Ogni chiamata DB blocca l'intero server; un `POST /locations/enrich` con molte descrizioni da risolvere (1,1 s l'una) lo **congela per minuti** — nessun'altra richiesta viene servita, nemmeno `/health`. Stesso tema per la geocodifica dentro `import/confirm` (import lenti se molte descrizioni nuove non risolvibili dal gazetteer).

**Fix banale e senza controindicazioni:** dichiarare gli endpoint `def` invece di `async def` (FastAPI li esegue in threadpool) e/o spostare l'enrich in un `BackgroundTask`. **Non serve** passare a un client async né riscrivere nulla.

Per il resto la struttura è giusta così. Nessuna ristrutturazione grossa da valutare.

---

## 🗑️ Dead code e zavorra repo ✅ RISOLTO (luglio 2026)

| Cosa | Dove | Esito |
|---|---|---|
| Vecchia app Streamlit (10 file) | `finance-tracker/old-version/` | ✅ Eliminata (la storia resta in git) |
| Mockup/piani fase design (12 file) | `mocks/` | ✅ Eliminati |
| Report refactoring passato | `aggiornamento.md` (root) | ✅ Eliminato (contenuto assorbito da docs/) |
| Config Fly.io mai usata | `backend/fly.toml` | ✅ Eliminata |
| Endpoint mai chiamati dal frontend | `GET /locations/unresolved`, `PUT /locations/{description}` | ✅ Eliminati (con i metodi `locationsApi.unresolved`/`updateLocation` in `frontend/src/api/locations.ts`) |
| Campo non più inviato dal frontend | `ImportConfirmBody.col_location` (`import_router.py`) | ✅ Eliminato |
| Dipendenze test nell'immagine di produzione | `pytest`, `pytest-asyncio` in `backend/requirements.txt` | ✅ Spostate in `requirements-dev.txt` |
| Funzione scritta per il futuro | `enrich_with_overpass` (`geocoder.py`) | **Tenuta** (precisione POI, pianificata) |

---

## Ordine di intervento consigliato

1. ~~**RLS su tutte le tabelle** (S1)~~ ✅ fatto.
2. ~~**B1 + B2 + B3 nel categorizer**~~ ✅ fatti (con 3 test nuovi, 29 totali).
3. ~~**`def` al posto di `async def`** (struttura) + S2, S3, S4~~ ✅ fatti.
4. ~~**Pulizia repo e dead code**~~ ✅ fatta.
5. ~~**B4 / B5 / B6**~~ ✅ fatti (B5 mitigato con warning nei log).

**Assessment completato: tutti i punti chiusi.** Unica sentinella residua: il warning `_ALL_ROWS` nei log di Railway (B5) — quando comparirà, paginare summary/timeline.
