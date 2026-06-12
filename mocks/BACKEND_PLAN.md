# Piano Backend — Finance Tracker v2

## Stack
- **Framework:** FastAPI (Python)
- **Database:** Supabase (Postgres) + Supabase Auth
- **Hosting:** Railway
- **Test:** pytest + httpx
- **Security:** slowapi (rate limiting), CORS nativo FastAPI, audit log su Supabase

---

## Struttura del progetto

```
finance-tracker/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── transactions.py
│   │   ├── import_router.py
│   │   ├── categories.py
│   │   ├── settings.py
│   │   └── auth.py               — NEW: endpoint login/logout/me
│   ├── services/
│   │   ├── parser.py
│   │   ├── categorizer.py
│   │   ├── deduplicator.py
│   │   └── audit.py              — NEW: log azioni critiche
│   ├── models/
│   │   ├── transaction.py
│   │   └── settings.py
│   ├── db/
│   │   └── supabase.py
│   └── tests/
│       ├── test_parser.py
│       ├── test_deduplicator.py
│       ├── test_categories.py
│       └── test_split.py
├── frontend/                         — React (fase 2)
├── docs/
│   ├── BACKEND_PLAN.md               — questo file
│   ├── README.md
│   └── DB_SCHEMA.md
└── README.md
```

---

## Autenticazione e sicurezza

### Flusso di accesso

L'app usa **Supabase Auth** con email e password.
Il frontend gestisce il login e ottiene un JWT da Supabase.
Ogni chiamata al backend include il JWT nell'header:

```
Authorization: Bearer <JWT_da_Supabase>
```

Il backend verifica il JWT con la chiave pubblica di Supabase —
non gestisce sessioni, non salva token, stateless.

```python
from supabase import create_client

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
):
    try:
        user = supabase.auth.get_user(credentials.credentials)
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")
```

### Gestione utenti

Gli utenti vengono creati direttamente dal pannello Supabase —
non serve un endpoint di registrazione pubblica.
Solo tu puoi aggiungere nuovi account.

Flusso utente:
```
Apre l'app → schermata login
           → inserisce email e password
           → Google Password Manager compila automaticamente (da 2a volta)
           → è dentro, sessione valida per settimane
```

### Endpoint auth (frontend li chiama direttamente su Supabase)

```
POST /auth/login     — email + password → JWT
POST /auth/logout    — invalida sessione
GET  /auth/me        — dati utente corrente
```

Questi endpoint sono gestiti da Supabase Auth SDK direttamente
nel frontend — il backend non li implementa.

---

## Sicurezza — misure adottate

### 1. Rate limiting (slowapi)

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/transactions")
@limiter.limit("100/hour")
async def get_transactions(...):
    ...
```

Applicato su tutti gli endpoint. Protegge Supabase free tier
e scoraggia scraping o abuso.

### 2. CORS ristretto

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://tuo-frontend.vercel.app"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

Solo il dominio del frontend può fare chiamate API dal browser.
In sviluppo locale si aggiunge `http://localhost:3000`.

### 3. Audit log (azioni critiche)

Tabella `audit_log` su Supabase. Si logga solo ciò che è
irreversibile o sensibile — non ogni GET.

**Azioni loggiate:**
- `DELETE /transactions/{id}` — eliminazione transazione
- `POST /import/confirm` — import completato (quante righe)
- `POST /transactions/{id}/split` — split creato
- `PUT /categories/{id}` — modifica keyword categoria
- `POST /categories/recategorize-all` — ricategorizzazione massiva
- Auth fallita (401) — tentativo accesso non autorizzato

```sql
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT        NOT NULL,   -- es. 'DELETE_TRANSACTION'
  user_email TEXT,                   -- chi ha fatto l'azione
  details    JSONB,                  -- es. { "transaction_id": 42, "amount": -45.0 }
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

Il servizio `audit.py` espone una funzione semplice:
```python
async def log(action: str, user_email: str, details: dict, ip: str):
    supabase.table("audit_log").insert({...}).execute()
```

### 4. Token — unico standard

Un solo token JWT per tutto. Niente token admin separato —
la gestione degli accessi è tutta in Supabase Auth.

---

## Database — Schema completo

### Migrazione iniziale (Weekend 1)

```sql
-- ── Estensione tabella transactions esistente ─────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source   TEXT    DEFAULT 'manuale'
    CHECK (source IN ('import', 'manuale'));

-- ── Indici per performance ────────────────────────────────────────────────
-- Senza questi, query su date con migliaia di righe diventano lente.
CREATE INDEX IF NOT EXISTS idx_transactions_date
  ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON transactions(category);

CREATE INDEX IF NOT EXISTS idx_transactions_date_amount
  ON transactions(date, amount);    -- usato da summary e timeline

-- ── Tabella categories ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  keywords   TEXT[]  DEFAULT '{}',
  color      TEXT    DEFAULT '#6C9BCF',
  icon       TEXT    DEFAULT '🏷️',
  budget     NUMERIC,
  is_income  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tabella import_profiles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_profiles (
  id            BIGSERIAL PRIMARY KEY,
  bank_name     TEXT NOT NULL,
  col_date      TEXT NOT NULL,
  col_desc      TEXT NOT NULL,
  amount_format TEXT NOT NULL CHECK (amount_format IN ('single', 'dare_avere')),
  col_amount    TEXT,
  col_dare      TEXT,
  col_avere     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_profiles_bank
  ON import_profiles(bank_name);

-- ── Tabella settings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY
               CHECK (key IN (
                 'saldo_attuale',
                 'valuta',
                 'default_import_profile'
               )),
  value      TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text'
               CHECK (value_type IN ('text', 'numeric', 'integer'))
);

INSERT INTO settings (key, value, value_type) VALUES
  ('saldo_attuale',          '0',   'numeric'),
  ('valuta',                 'EUR', 'text'),
  ('default_import_profile', '0',   'integer')
ON CONFLICT (key) DO NOTHING;

-- ── Tabella split_items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS split_items (
  id             BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
  category       TEXT    NOT NULL,
  amount         NUMERIC NOT NULL,
  note           TEXT    DEFAULT ''
);

-- ── Tabella audit_log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT        NOT NULL,
  user_email TEXT,
  details    JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);
```

### Seed categorie di default

```sql
INSERT INTO categories (name, keywords, color, icon) VALUES
  ('Spesa alimentare',  ARRAY['esselunga','conad','lidl','penny','md '],         '#6CBF8E', '🛒'),
  ('Ristoranti & Bar',  ARRAY['bar','ristorante','pizzeria','mcdonald','caffe'], '#EF7B7B', '🍽️'),
  ('Trasporti',         ARRAY['trenitalia','atm','uber','tamoil','telepass'],    '#6C9BCF', '🚗'),
  ('Salute & Farmacia', ARRAY['farmacia','medico','dentista','studio pizzi'],    '#A78BFA', '💊'),
  ('Shopping',          ARRAY['amazon','zara','h&m','hm it','zalando'],          '#F59E0B', '🛍️'),
  ('Abbonamenti',       ARRAY['netflix','spotify','claude.ai','google one'],     '#EC4899', '📱'),
  ('Utenze & Casa',     ARRAY['enel','vodafone','tim','affitto','condominio'],   '#14B8A6', '🏠'),
  ('Banca & Finanza',   ARRAY['commissione','prelievo','bonifico'],              '#64748B', '🏦'),
  ('Benessere & Sport', ARRAY['palestra','farmacia','parrucchiere'],             '#84CC16', '💪'),
  ('Viaggi & Hotel',    ARRAY['hotel','booking','airbnb','ryanair'],             '#F97316', '✈️'),
  ('Stipendio',         ARRAY['stipendio','accredito stipendio'],                '#10B981', '💰'),
  ('Entrate varie',     ARRAY['accredito','rimborso'],                           '#06B6D4', '📥')
ON CONFLICT (name) DO NOTHING;
```

---

## API Endpoints

Tutti gli endpoint richiedono `Authorization: Bearer <JWT>`.

### Transazioni

```
GET /transactions
    ?from=2026-01-01
    ?to=2026-04-30
    ?category=Shopping
    ?source=import|manuale
    ?search=esselunga
    ?limit=50&offset=0
    → { data: [...], total: 243 }

GET /transactions/summary
    ?from=2026-01-01&to=2026-04-30
    → { spese_totali, entrate_totali, per_categoria: [...] }

GET /transactions/timeline
    ?from=2026-01-01&to=2026-04-30
    ?granularity=day|month
    → saldo cumulativo via SQL window function

POST /transactions
    body: { date, description, amount, category, source, note, tags }

PUT /transactions/{id}
    body: { category?, note?, tags? }

DELETE /transactions/{id}
    → 204 No Content
    → audit log: DELETE_TRANSACTION

POST /transactions/{id}/split
    body: { items: [{ category, amount, note }] }
    — sum(items.amount) deve == transaction.amount
    — se no → 400: { "error": "Differenza: €3.00" }
    → audit log: SPLIT_CREATED
```

### Import

```
POST /import/preview
    body: multipart file
    → { columns, sample, suggested_profile }
    — NON salva nulla

POST /import/confirm
    body: { profile_id?, bank_name?, col_date, col_desc,
            amount_format, col_amount?, col_dare?, col_avere?, rows }
    → { imported, skipped_duplicates, uncategorized, errors }
    → audit log: IMPORT_COMPLETED

GET    /import/profiles
POST   /import/profiles
PUT    /import/profiles/{id}
DELETE /import/profiles/{id}
```

### Categorie

```
GET    /categories
POST   /categories
PUT    /categories/{id}        → audit log: CATEGORY_UPDATED
DELETE /categories/{id}

POST   /categories/recategorize-all
       → { updated: 12 }
       → audit log: RECATEGORIZE_ALL
```

### Impostazioni

```
GET /settings
    → valori castati al tipo corretto (numeric → float)

PUT /settings/{key}
    body: { value: "5500.00" }
```

---

## Logica dei servizi

### `parser.py`
- Legge CSV/Excel, rileva encoding e separatore
- Normalizza importi europei
- Suggerisce profilo banca dal match colonne
- Restituisce righe normalizzate + profilo suggerito

### `categorizer.py`
- Legge keywords da DB ad ogni chiamata (nessuna cache)
- `categorize(description) → str`
- `recategorize_all() → int`
- Stub AI pronto per Claude fallback

### `deduplicator.py`
- Query SQL puntuale per ogni riga (no full scan)
- Restituisce: nuove + duplicate con ID esistente

### `audit.py`
```python
async def log(action: str, user_email: str, details: dict, ip: str):
    supabase.table("audit_log").insert({
        "action":     action,
        "user_email": user_email,
        "details":    details,
        "ip":         ip,
    }).execute()
```

---

## Query SQL ottimizzate

**Summary:**
```sql
SELECT
  category,
  SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) AS spese,
  SUM(CASE WHEN amount > 0 THEN amount        ELSE 0 END) AS entrate,
  COUNT(*) AS n_transazioni
FROM transactions
WHERE date BETWEEN $1 AND $2
GROUP BY category
ORDER BY spese DESC
```

**Timeline:**
```sql
SELECT date,
  SUM(amount) OVER (ORDER BY date ROWS UNBOUNDED PRECEDING) AS saldo
FROM (
  SELECT date, SUM(amount) AS amount
  FROM transactions
  WHERE date BETWEEN $1 AND $2
  GROUP BY date
) daily
ORDER BY date
```

---

## Test

### `test_parser.py`
- CSV `;` e `,`, Excel `.xlsx`
- Importo europeo, migliaia, Dare/Avere
- Righe malformate → saltate
- Rilevamento profilo Intesa Sanpaolo

### `test_deduplicator.py`
- Riga nuova, duplicata, stesso giorno importo diverso
- Batch misto → report corretto

### `test_categories.py`
- Match case-insensitive, parziale, non trovato → "Altro"
- Modifica keyword → effetto immediato (nessuna cache)

### `test_split.py`
- Somma corretta → 200
- Somma errata → 400 con differenza
- Meno di 2 items → 400

---

## Roadmap implementazione

### Weekend 0.5 — Test sul codice esistente
- Setup pytest
- `test_parser.py` e `test_deduplicator.py` sul codice Streamlit

### Weekend 1 — Fondamenta + sicurezza base
- Struttura cartelle, `main.py`
- CORS ristretto al dominio frontend
- Rate limiting con slowapi su tutti gli endpoint
- `db/supabase.py`, migrazione SQL (indici + tabelle + seed)
- Endpoint `/transactions` con filtri e paginazione
- Endpoint `/transactions/summary` e `/transactions/timeline`
- Deploy su Railway
- **Deliverable:** `docs/README.md`, `docs/DB_SCHEMA.md`

### Weekend 2 — Import
- `services/parser.py` con rilevamento profilo
- `services/deduplicator.py`
- Endpoint `/import/preview` e `/import/confirm`
- Endpoint CRUD `/import/profiles`

### Weekend 3 — Auth + categorie + features
- **Supabase Auth:** abilitazione email/password dal pannello Supabase
- Sostituzione Bearer token statico con verifica JWT Supabase
- `services/audit.py` + tabella `audit_log`
- Audit log su delete, import, split, recategorize
- `services/categorizer.py` senza cache
- Endpoint CRUD `/categories` + `/categories/recategorize-all`
- Endpoint `/transactions/{id}/split`
- Endpoint `/settings`

### Weekend 4 — Rifinitura
- Gestione errori robusta, Pydantic su tutti i body
- `test_split.py`
- Swagger UI su `/docs`
- `README.md` e `DB_SCHEMA.md` finali

---

## Note future

- **Claude AI:** stub nel categorizer, aggiungere chiamata quando nessuna keyword matcha
- **Frontend React:** endpoint già pronti
- **Multi-utente:** aggiungere `user_id` alle tabelle, già supportato da Supabase Auth
