# Assessment — Finance Tracker

**Data:** luglio 2026.
**Scope:** revisione completa di struttura, dead code, sviste funzionali e security su tutto il repo (backend, frontend, migration, config di deploy). Contesto: app per uso personale, l'unico utente è lo sviluppatore.

**Verifiche automatiche eseguite:** 26 test backend passati · `ruff check` pulito · `mypy` pulito · `tsc --noEmit` pulito.

**Verdetto generale:** codice in salute, architettura giusta (router/services separati, modelli Pydantic, keyword centralizzate, frontend ordinato in pages/components/hooks/api). **Nessuna ristrutturazione grossa necessaria.** Un punto di security serio (RLS), alcuni bug funzionali reali nel categorizer, un appunto strutturale sull'event loop e un po' di zavorra nel repo.

---

## 🔴 Security

### S1 — Nessuna RLS sulle tabelle (il punto serio)

Le migration (`migration_v2.sql` e successive) non abilitano mai la Row Level Security. Su Supabase le tabelle nello schema `public` sono esposte via API REST (PostgREST), e la **anon key sta nel bundle JS pubblico** su Vercel — chiunque apra i DevTools la trova. Senza RLS, con anon key + URL Supabase si possono **leggere e scrivere tutte le tabelle direttamente**, bypassando completamente il backend e la sua autenticazione: transazioni, saldo, audit log, tutto.

**Fix (indolore):** una migration che fa `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` su tutte le 7 tabelle (`transactions`, `categories`, `split_items`, `import_profiles`, `settings`, `user_rules`, `audit_log`, più `merchant_locations`) **senza aggiungere alcuna policy**. Il backend usa la service role key che bypassa la RLS → non cambia nulla per l'app; il frontend usa Supabase solo per l'auth, mai per i dati → non si rompe nulla. È il fix a più alto rapporto beneficio/costo di tutta la lista.

> Da verificare prima nel dashboard Supabase: **Database → Tables → colonna RLS**. Se la RLS fosse già stata abilitata a mano, questo punto decade.

### S2 — `ENV=production` non impostato su Railway

`deploy.md` non lo elenca tra le variabili (lo impostava solo il `fly.toml` morto). Effetto: in produzione resta attiva la regex CORS `http://localhost:*` di `main.py`. Rischio basso in pratica, fix a costo zero: aggiungere la variabile su Railway (e a `deploy.md`).

### S3 — Rate limiting e IP audit dietro proxy

Uvicorn parte senza `--proxy-headers` (`backend/Dockerfile`), quindi `request.client.host` è l'IP del proxy Railway, non del client: tutti i limiti slowapi condividono un unico bucket e l'IP nell'audit log è sempre quello interno. Con un solo utente è quasi irrilevante. Fix: `CMD [..., "--proxy-headers", "--forwarded-allow-ips", "*"]`.

### S4 — `/docs` (Swagger) pubblico senza auth

Espone lo schema API a chiunque. Gli endpoint restano protetti, quindi è solo ricognizione; si può disattivare in produzione (`docs_url=None` se `ENV=production`).

### Verificato e a posto

- JWT validato su ogni richiesta con cache 60 s documentata (`deps.py`) — tradeoff accettabile e dichiarato.
- Nessun `dangerouslySetInnerHTML`; l'unico HTML template è il tooltip Leaflet in `Mappa.tsx` con dati propri.
- `.gitignore` corretto sui `.env`; nessun segreto committato.
- Upload limitato a 10 MB; validazioni input sensate (descrizione vuota, importo zero, settings tipizzate).
- Audit log best-effort ma con logging del fallimento.

---

## 🟠 Bug e sviste funzionali

### B1 — Keyword delle categorie entrata dal DB ignorate

`categorize()` (`services/categorizer.py`) itera `INCOME_RULES` hardcoded; `load_db_categories()` (`services/category_keywords.py`) esclude esplicitamente le categorie income. Quindi modificare le keyword di Contanti/Rimborsi dalle Impostazioni **non ha alcun effetto**, mentre il README dichiara il contrario ("per le entrate solo le parole chiave").

### B2 — Le categorie nuove create dall'utente non vengono mai matchate

Sempre in `categorize()`, il loop spese itera i nomi di `EXPENSE_RULES` hardcoded: una categoria creata via `POST /categories` con le sue keyword esiste nel DB ma il categorizzatore non la considererà mai. Oggi non morde (si usano le 13 seed), ma è una trappola silenziosa.

### B3 — Soglia stipendio prima delle regole utente

`amount > 600` → Stipendio vince su tutto, anche su una user rule esplicita: un rimborso da 700 € finirà sempre in Stipendio e non c'è modo di correggerlo in modo persistente. Basterebbe spostare il check dopo le user rules.

### B4 — Split non atomico e modificabile a posteriori

In `split_transaction` si setta `is_split=True` e *poi* si inseriscono le parti: se il secondo insert fallisce resta una transazione "divisa" senza parti (Supabase REST non ha transazioni SQL). Inoltre `PUT /transactions/{id}` permette di cambiare l'`amount` di una transazione già splittata senza ricontrollare la somma delle parti.

### B5 — Tetto `_ALL_ROWS = 10.000` silenzioso sul saldo

Timeline e summary caricano al massimo 10k righe: superata la soglia (qualche anno di dati), il saldo cumulativo diventa **sbagliato senza alcun segnale**. Da tenere d'occhio — o alzare il limite con un log di warning quando viene raggiunto.

### B6 — Minori

- `set_category` con `ids` espliciti non filtra `deleted_at`.
- Il parser dichiara supporto `.xls` (vecchio formato) ma `xlrd` non è nei requirements → fallirebbe (solo `.xlsx` funziona).
- `restore` e `DELETE /categories` non sono auditati mentre le operazioni gemelle sì.

---

## 🟡 Struttura — un solo appunto vero

### Endpoint `async def` + client sincrono = event loop bloccato

Tutti gli endpoint sono `async` ma usano il client Supabase sincrono, httpx sincrono e perfino `time.sleep` nel throttle Nominatim (`geocoder.py`). Ogni chiamata DB blocca l'intero server; un `POST /locations/enrich` con molte descrizioni da risolvere (1,1 s l'una) lo **congela per minuti** — nessun'altra richiesta viene servita, nemmeno `/health`. Stesso tema per la geocodifica dentro `import/confirm` (import lenti se molte descrizioni nuove non risolvibili dal gazetteer).

**Fix banale e senza controindicazioni:** dichiarare gli endpoint `def` invece di `async def` (FastAPI li esegue in threadpool) e/o spostare l'enrich in un `BackgroundTask`. **Non serve** passare a un client async né riscrivere nulla.

Per il resto la struttura è giusta così. Nessuna ristrutturazione grossa da valutare.

---

## 🗑️ Dead code e zavorra repo

| Cosa | Dove | Azione suggerita |
|---|---|---|
| Vecchia app Streamlit (10 file) | `finance-tracker/old-version/` | Eliminare (la storia resta in git) |
| Mockup/piani fase design (12 file) | `mocks/` | Eliminare (o spostare in `evoluzioni/`) |
| Report refactoring passato | `aggiornamento.md` (root) | Eliminare (contenuto assorbito da docs/) |
| Config Fly.io mai usata | `backend/fly.toml` | Eliminare (nota: conteneva `ENV=production`, vedi S2) |
| Endpoint mai chiamati dal frontend | `GET /locations/unresolved`, `PUT /locations/{description}` | Eliminare (con i metodi `locationsApi.unresolved`/`updateLocation` in `frontend/src/api/locations.ts`) |
| Campo non più inviato dal frontend | `ImportConfirmBody.col_location` (`import_router.py`) | Eliminare |
| Dipendenze test nell'immagine di produzione | `pytest`, `pytest-asyncio` in `backend/requirements.txt` | Spostare in `requirements-dev.txt` |
| Funzione scritta per il futuro | `enrich_with_overpass` (`geocoder.py`) | **Tenere** (precisione POI, pianificata) |

---

## Ordine di intervento consigliato

1. **RLS su tutte le tabelle** (S1) — migration di poche righe, chiude l'unico buco reale.
2. **B1 + B2 + B3 nel categorizer** — un solo file, sistema tre incoerenze.
3. **`def` al posto di `async def`** + `ENV=production` e `--proxy-headers` (S2, S3, struttura).
4. **Pulizia repo e dead code** — mezz'ora, zero rischio.
5. **B4 / B5 / B6 e `/docs`** — quando capita.
