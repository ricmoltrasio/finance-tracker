# Evolutive — Mappa transazioni geolocalizzate

**Stato:** implementata (MVP funzionante, vedi differenze rispetto al piano in fondo).
**Data progettazione:** giugno 2026.
**Data implementazione:** giugno 2026.

---

## Idea

Una schermata **Mappa** con le transazioni geolocalizzate, aggregate per città:
- ogni città ha un marker con conteggio/somma delle spese (cluster se vicine);
- click sul marker → sidebar con l'elenco delle transazioni di quella città;
- click su una transazione → drawer di modifica incorporato nella sidebar.

La mappa mostra **solo le spese** (importo negativo), le entrate sono escluse a monte (query backend).

---

## Da dove arriva la posizione

Non c'è una colonna "Luogo" dedicata nel mapper di import: la **description** completa della transazione (es. `Penny Market S.r.l. Monza`, `Saronno VA`) viene passata al geocoder, che prova a estrarne la città dagli ultimi 1, 2 e 3 token.

`services/geocoder.py`:
1. Rimuove un'eventuale **sigla provincia finale** se è un token a sé stante (`"Saronno VA"` → `"Saronno"`, `"Milano (MI)"` → `"Milano"`) — non tocca le ultime 2 lettere di una singola parola, per evitare falsi positivi tipo `"Lainate"` → `"Laina"` (bug corretto durante l'implementazione).
2. Esclude candidati noti come falsi positivi (es. `"Milan"` in inglese, spesso in abbonamenti/servizi esteri, che altrimenti risolverebbe a Milano via Nominatim). `"Milano"` in italiano resta valido.
3. Prova il **gazetteer locale** (`data/comuni.json`, 173 comuni/capoluoghi principali).
4. Se assente, fallback su **Nominatim** (OSM), con throttle a 1 req/s e cache in-process.

---

## Architettura: tabella lookup + override per-transazione

### `merchant_locations` (come da piano originale)

Geocodifica **per esercente** (per `description` normalizzata), non per singola transazione. Un esercente risolto una volta vale per tutte le sue transazioni passate/future.

```sql
CREATE TABLE merchant_locations (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT    NOT NULL UNIQUE,
  city        TEXT,
  country     TEXT    DEFAULT 'IT',
  lat         NUMERIC,
  lng         NUMERIC,
  source      TEXT    DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### `transactions.loc_city/loc_lat/loc_lng` (NON previsto dal piano originale, aggiunto in corsa)

Il piano originale escludeva esplicitamente colonne di posizione su `transactions` ("le transazioni non memorizzano city/lat/lng"). In pratica si è rivelato necessario un **override per singola transazione** (o per gruppo), per correggere un esercente senza toccare `merchant_locations` condiviso — usato dalla UI di correzione manuale nel drawer. Priorità: `loc_city` (se valorizzato) > join su `merchant_locations`.

```sql
ALTER TABLE transactions
  ADD COLUMN loc_city TEXT,
  ADD COLUMN loc_lat  NUMERIC,
  ADD COLUMN loc_lng  NUMERIC;
```

### Flusso dati effettivo

```
Import CSV/Excel
  → geocodifica diretta dalla description (no colonna luogo separata)
  → upsert merchant_locations {description → city, lat, lng, source='auto'}

GET /locations/map?from=&to=
  → solo spese (amount < 0) del periodo, con lat/lng
  → priorità loc_city per-transazione, altrimenti join merchant_locations
  → aggregate per city con somma/conteggio

PUT /transactions/{id}/location  (correzione manuale, dal drawer)
  → body { city, only_this, ids } + dry_run per anteprima
  → only_this=true  → set loc_city/loc_lat/loc_lng solo su quella riga
  → only_this=false → upsert merchant_locations source='manual' (tutte le righe con la stessa description)
  → city vuota → cancella l'override (e la voce in merchant_locations se non only_this)

POST /locations/enrich  ("📍 Arricchisci posizioni" sulla pagina Mappa)
  → geocodifica retroattiva per ogni description ancora assente da merchant_locations
  → NON riprocessa description già presenti (anche se il risultato era sbagliato):
    per ricalcolare tutto serve uno svuotamento manuale (docs/reset_locations.sql)
```

---

## Componenti realizzati

### Dati
- `backend/data/comuni.json` — gazetteer statico, 173 comuni/capoluoghi (non l'intero bundle ISTAT da ~8.000 comuni previsto dal piano: i comuni minori passano dal fallback Nominatim).
- `docs/migration_merchant_locations.sql`
- `docs/migration_transaction_location_override.sql` (non previsto dal piano)
- `docs/reset_locations.sql` — script una-tantum per azzerare tutte le posizioni (manuali e auto) e forzare un ricalcolo completo dopo un fix al geocoder.

### Backend
- `services/geocoder.py` — estrazione città (sigla provincia + falsi positivi noti) + gazetteer + fallback Nominatim.
- `services/geocoder.py: enrich_with_overpass()` — **scritta ma non collegata a nessun endpoint**: la precisione a livello POI via Overpass (fase 2 del piano) non è stata attivata, si resta al centroide del comune.
- `routers/locations.py`:
  - `GET /locations/map?from=&to=` — solo spese, aggregate per city.
  - `POST /locations/enrich` — geocodifica retroattiva bulk.
  - `GET /locations/unresolved`, `PUT /locations/{description}` — scritti per il piano originale ("pannello esercenti senza posizione") ma **non usati dal frontend**: la correzione manuale è finita nel drawer transazione (vedi sotto).
- `routers/transactions.py: PUT /{id}/location` — endpoint realmente usato per la correzione manuale, con preview (`dry_run`) e scelta "solo questa" vs "tutte le transazioni di questo esercente", sullo stesso pattern già esistente per la categoria.
- Risposta `/transactions` arricchita con `city` calcolato (override per-riga o join `merchant_locations`).

### Import
- Nessun campo "Colonna luogo" nel mapper (il piano lo prevedeva): si geocodifica direttamente dalla colonna descrizione già mappata, senza passaggio utente aggiuntivo.

### Frontend
- `pages/Mappa.tsx` — Leaflet + `leaflet.markercluster`, selettore periodo (Questo mese/3m/6m/12m/Quest'anno via `PeriodChip`) **+ selettore "Mese specifico"** (stesso pattern di Transazioni/Budget, non previsto nel piano originale), pulsante "Arricchisci posizioni".
- Tile layer: provate diverse alternative a OSM standard (CartoDB Dark Matter, Positron, Voyager, Esri World Street Map) — **scelta attuale: CartoDB Voyager** (`basemaps.cartocdn.com/rastertiles/voyager`), via di mezzo tra i colori di OSM classico e la pulizia di Positron.
- Sidebar città: lista transazioni con `CatGlyph` (icona) + categoria colorata, stesso stile della pagina Transazioni.
- Click su transazione → `EditDrawer` incorporato (`variant="embedded"`) nella sidebar stessa, non un drawer separato sovrapposto.
- `TransactionRow.tsx` — chip città (📍) quando disponibile, in tutte le liste transazioni dell'app.
- `TransactionDrawer.tsx` — campo di correzione posizione con anteprima e scelta "solo questa/tutte", stesso UX della correzione categoria.

---

## Differenze rispetto al piano originale

| Previsto | Realizzato |
|---|---|
| Colonna "Luogo" opzionale nel mapper di import | Geocodifica diretta dalla description, nessun campo extra nel mapper |
| Gazetteer ISTAT ~8.000 comuni | Gazetteer ridotto (173, capoluoghi/comuni principali) + fallback Nominatim per il resto |
| `transactions` senza colonne di posizione | Aggiunte `loc_city/loc_lat/loc_lng` come override per-transazione |
| Overpass per precisione POI (fase 2) | Funzione scritta (`enrich_with_overpass`) ma mai collegata: si resta al centroide comune |
| Pannello dedicato "esercenti senza posizione" per correzione manuale | Correzione manuale integrata nel drawer di modifica transazione, con preview e scope "solo questa/tutte" |
| — (non previsto) | Selettore "Mese specifico" sulla Mappa |
| — (non previsto) | Mappa mostra solo le spese, entrate escluse |
| — (non previsto) | Tile layer CartoDB Voyager al posto di OSM standard |

## Limiti noti

- `POST /locations/enrich` non riprocessa description già presenti in `merchant_locations`, anche se il risultato salvato è sbagliato (es. dopo un fix al geocoder serve `docs/reset_locations.sql` per ricalcolare da zero).
- Nessuna UI per Overpass/precisione POI: tutte le posizioni sono a livello di centroide comune.
- Comuni esteri: solo se Nominatim li risolve esplicitamente (query forzata su `countrycodes=it`, quindi di fatto **le città estere sono escluse**, non solo "incluse se risolte" come da piano).
