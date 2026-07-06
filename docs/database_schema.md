# Schema Database — Finance Tracker

Database: **PostgreSQL** (Supabase). L'autenticazione è gestita da Supabase Auth (schema `auth`), non documentato qui. Lo script di creazione è [`migration_v2.sql`](./migration_v2.sql).

---

## Diagramma relazioni

```
                       ┌──────────────────────────┐
                       │       transactions        │
                       │──────────────────────────│
                       │ id              PK        │
                       │ date                      │
                       │ description               │◄──── normalizzata → lookup merchant_locations
                       │ amount                    │
                       │ category                  │◄──── match logico con categories.name
                       │ source                    │
                       │ note                      │
                       │ tags  TEXT[]              │
                       │ is_split                  │
                       │ deleted_at                │      soft delete
                       │ loc_city                  │ ─┐
                       │ loc_lat                   │  │  override posizione per-transazione
                       │ loc_lng                   │ ─┘  (priorità su merchant_locations)
                       └──────────┬────────────────┘
                                  │ 1
                                  │
                                  │ N
                       ┌──────────▼────────────────┐
                       │        split_items         │
                       │──────────────────────────  │
                       │ id              PK         │
                       │ transaction_id  FK         │──► transactions.id  (ON DELETE CASCADE)
                       │ category                   │
                       │ amount                     │
                       │ note                       │
                       └────────────────────────────┘

   ┌──────────────┐   ┌────────────────────┐   ┌──────────────┐
   │  categories  │   │  import_profiles   │   │   settings   │
   └──────────────┘   └────────────────────┘   └──────────────┘

   ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐
   │  user_rules  │   │  audit_log   │   │  merchant_locations  │
   └──────────────┘   └──────────────┘   └──────────────────────┘
```

> **Nota sulle relazioni**: l'unica foreign key reale è `split_items.transaction_id → transactions.id`. Il collegamento tra `transactions.category` e `categories.name` è *logico* (per nome), non vincolato da FK. Il collegamento tra `transactions.description` e `merchant_locations.description` è anch'esso logico (normalizzazione: strip + lower + collapse spaces).

---

## Tabelle

### `transactions`
Movimenti finanziari. È la tabella centrale.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `date` | DATE | Data del movimento |
| `description` | TEXT | Descrizione/causale grezza dalla banca |
| `amount` | NUMERIC | Negativo = uscita, positivo = entrata |
| `category` | TEXT | Nome categoria (match logico con `categories.name`) |
| `source` | TEXT | `import` \| `manuale` — CHECK constraint |
| `note` | TEXT | Nota libera |
| `tags` | TEXT[] | Default `{}` |
| `is_split` | BOOLEAN | Default `FALSE`; `TRUE` se suddivisa in `split_items` |
| `deleted_at` | TIMESTAMPTZ | Default `NULL`; valorizzato dal soft-delete (la riga non viene rimossa fisicamente) |
| `loc_city` | TEXT | Override posizione per questa transazione; `NULL` = usa `merchant_locations` |
| `loc_lat` | NUMERIC | Latitudine override (valorizzato insieme a `loc_city`) |
| `loc_lng` | NUMERIC | Longitudine override (valorizzato insieme a `loc_city`) |

**Indici**
- `idx_transactions_date` su `(date)`
- `idx_transactions_category` su `(category)`
- `idx_transactions_date_amount` su `(date, amount)`
- `idx_transactions_deleted_at` su `(deleted_at) WHERE deleted_at IS NOT NULL` (partial index)

**Migration**: `migration_v2.sql` + `migration_soft_delete.sql` + `migration_transaction_location_override.sql`

---

### `merchant_locations`
Lookup posizione per esercente (descrizione normalizzata → coordinate). Popolata automaticamente al momento dell'import e tramite `POST /locations/enrich`. La correzione manuale da drawer imposta `source='manual'`.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `description` | TEXT | **UNIQUE**, NOT NULL — descrizione normalizzata (strip + lower + collapse spaces) |
| `city` | TEXT | Nome città (lowercase) |
| `country` | TEXT | Default `'IT'` |
| `lat` | NUMERIC | Latitudine (centroide comune da gazetteer o Nominatim) |
| `lng` | NUMERIC | Longitudine |
| `source` | TEXT | Default `'auto'` — CHECK in (`auto`, `manual`). `'manual'` blocca la sovrascrittura automatica |
| `resolved_at` | TIMESTAMPTZ | Riservato per precisione POI via Overpass (non ancora usato) |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indici**: `idx_merchant_locations_description` su `(description)`.

**Priorità posizione**: se `transactions.loc_city` è valorizzato, ha la precedenza su `merchant_locations`. Questo permette di correggere la posizione di una singola transazione (o di un gruppo con `only_this=false`) senza alterare il lookup condiviso.

**Migration**: `migration_merchant_locations.sql`

---

### `categories`
Catalogo categorie con keyword per la categorizzazione automatica e budget mensile.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `name` | TEXT | **UNIQUE**, NOT NULL |
| `keywords` | TEXT[] | Default `{}` — parole chiave per il matching (fonte di verità) |
| `color` | TEXT | Default `#6C9BCF` |
| `icon` | TEXT | Default `🏷️` |
| `budget` | NUMERIC | Budget mensile teorico (NULL/0 = nessun budget). Solo categorie di uscita |
| `is_income` | BOOLEAN | Default `FALSE` |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Categorie seed** (13): Cibo, Auto, Salute, Intrattenimento, Abbonamenti, Shopping, Teatro e cinema, Spostamenti, Viaggi, Altro (uscite); Stipendio, Contanti, Rimborsi (entrate).

> Il backend esegue un **lazy seed** delle `keywords` al primo `GET /categories`: se una categoria ha l'array vuoto, viene popolata con le keyword hardcoded di `services/categorizer.py`.

---

### `split_items`
Parti di una transazione suddivisa su più categorie. La somma degli `amount` deve coincidere con l'importo della transazione originale (validato lato API).

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `transaction_id` | BIGINT | **FK → transactions.id**, `ON DELETE CASCADE` |
| `category` | TEXT | NOT NULL |
| `amount` | NUMERIC | NOT NULL |
| `note` | TEXT | Default `''` |

---

### `import_profiles`
Mappature colonne riutilizzabili per banca, usate dall'importazione.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `bank_name` | TEXT | NOT NULL |
| `col_date` | TEXT | NOT NULL — nome colonna data |
| `col_desc` | TEXT | NOT NULL — nome colonna descrizione |
| `amount_format` | TEXT | `single` \| `dare_avere` — CHECK constraint |
| `col_amount` | TEXT | Usata se `amount_format = single` |
| `col_dare` | TEXT | Usata se `amount_format = dare_avere` (uscite) |
| `col_avere` | TEXT | Usata se `amount_format = dare_avere` (entrate) |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indici**: `idx_import_profiles_bank` su `(bank_name)`.

---

### `settings`
Configurazione applicativa key-value tipizzata.

| Colonna | Tipo | Note |
|---|---|---|
| `key` | TEXT | PK — CHECK in (`saldo_iniziale`, `valuta`, `default_import_profile`) |
| `value` | TEXT | NOT NULL — valore serializzato come stringa |
| `value_type` | TEXT | `text` \| `numeric` \| `integer` — guida il cast lato API |

**Righe seed**: `saldo_iniziale=0` (numeric), `valuta=EUR` (text), `default_import_profile=0` (integer).

---

### `user_rules`
Regole di categorizzazione apprese dall'utente. Quando si assegna manualmente una categoria a una transazione, la descrizione (normalizzata lowercase) diventa un `pattern` con priorità sulle keyword.

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `pattern` | TEXT | **UNIQUE**, NOT NULL — sottostringa cercata nella descrizione |
| `category` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indici**: `idx_user_rules_pattern` su `(pattern)`. L'inserimento usa upsert su `pattern`.

---

### `audit_log`
Traccia delle azioni sensibili. Scrittura best-effort (non blocca mai il flusso applicativo).

| Colonna | Tipo | Note |
|---|---|---|
| `id` | BIGSERIAL | PK |
| `action` | TEXT | NOT NULL — es. `DELETE_TRANSACTION`, `SPLIT_CREATED`, `RECATEGORIZE_ALL`, `IMPORT_COMPLETED`, `CATEGORY_UPDATED` |
| `user_email` | TEXT | Email dell'utente autenticato |
| `details` | JSONB | Payload contestuale dell'azione |
| `ip` | TEXT | IP del client |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

**Indici**: `idx_audit_log_created` su `(created_at DESC)`.

---

## Convenzioni e regole applicative (non vincolate da constraint DB)

- **Segno importo**: uscite negative, entrate positive. `summary` e `timeline` distinguono per segno.
- **Soft delete**: le transazioni eliminate non vengono rimosse fisicamente — viene impostato `deleted_at`. Tutte le query applicative filtrano `WHERE deleted_at IS NULL`. Il deduplicatore confronta anche con le righe soft-deleted per prevenire re-import.
- **Soglia stipendio**: importi `> 600` sono categorizzati come `Stipendio` indipendentemente dalla descrizione, **salvo** una regola utente esplicita (`user_rules`), che ha priorità.
- **Deduplicazione**: identità di un movimento = `(date, lower(trim(description)), round(amount, 2))`.
- **Budget**: valorizzato solo sulle categorie di uscita; le proiezioni di fine mese sono calcolate lato frontend solo per `Cibo` e `Auto`.
- **Categorie testuali**: `transactions.category` può contenere nomi non presenti in `categories` (es. `Altro`, `Stipendio`), per questo non esiste una FK.
- **Priorità posizione**: `transactions.loc_city` (override per-transazione, impostato dalla correzione manuale nel drawer) ha priorità su `merchant_locations` (lookup per esercente). Se entrambi sono assenti la transazione non compare sulla mappa.
- **Geocodifica per esercente**: `merchant_locations.source='manual'` protegge dalla sovrascrittura automatica. Una descrizione già presente (qualunque `source`) non viene riprocessata da `POST /locations/enrich` — usare `docs/reset_locations.sql` per forzare un ricalcolo completo.
