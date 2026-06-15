# Evolutive — Mappa transazioni geolocalizzate

**Stato:** progettata, non implementata.
**Data progettazione:** giugno 2026.

---

## Idea

Una nuova schermata con una **mappa** su cui appaiono le transazioni in base al luogo in cui sono state fatte, con **aggregazione progressiva per area**:
- da lontano (zoom out) → un solo marcatore per città con la **somma** di tutte le spese (es. "Milano €1.240");
- avvicinandosi (zoom in) → il cluster si apre in raggruppamenti più piccoli e infine nelle singole transazioni.

---

## Il problema centrale: da dove ricaviamo la posizione?

### Come fa Intesa Sanpaolo (e perché non possiamo riusarlo)

Le transazioni con carta/POS viaggiano sui circuiti (Visa/Mastercard) portando un campo standard *card acceptor*: **nome esercente + città + paese** (più il codice **MCC** per la categoria merceologica). La banca riceve quindi la **città** direttamente dal circuito e la geocodifica (o usa una propria anagrafica esercenti).

**Limite per noi:** l'export CSV verso l'utente **non contiene coordinate**, e spesso nemmeno la città come campo separato. Al massimo la città è annegata nella **stringa descrizione** (es. `PAGAMENTO POS ESSELUNGA MILANO IT`). Quindi non possiamo importare la geolocalizzazione di Intesa: dobbiamo **ricostruirla dalla descrizione**.

### Conseguenza progettuale

Due intuizioni abbattono complessità e costi:
1. **Geocodificare per esercente, non per transazione.** Gli esercenti distinti sono molti meno delle transazioni e si ripetono. Si calcola la posizione una volta e si riusa (si lega naturalmente alla feature "esercenti" già esistente).
2. **Fermarsi al livello città.** È sufficiente per la UX ad aggregazione per area, e si ottiene gratis e offline da un dizionario dei comuni. La precisione stradale è un extra opzionale.

---

## Approcci per la geocodifica (dal più economico)

### A. Città da gazetteer locale (gratis, offline) — base consigliata
- Includere nell'app un **dataset dei comuni italiani** (ISTAT, ~8.000 comuni con lat/lng del centroide; disponibile liberamente).
- Estrarre la città dalla descrizione: tokenizzare, cercare token che combaciano con un nome di comune (spesso in maiuscolo, verso la fine, a volte seguiti da `IT` o dalla sigla provincia).
- Risultato: coordinate a livello città.
- **Costo:** zero. **Complessità:** media (euristica sulle stringhe + lookup). **Precisione:** città — perfetta per l'aggregazione per area.

### B. Geocoding API esterna (precisione stradale) — opzionale, dopo
- Nominatim/OpenStreetMap: gratis ma **max 1 req/s**, usage policy restrittiva (no bulk), richiede caching + attribuzione. Oppure Google/Mapbox (a pagamento).
- Da usare solo per gli esercenti non risolti dal gazetteer o quando si vuole il puntino preciso. **Obbligatorio** cachare per esercente.
- **Costo/complessità:** più alti, rate limit. Rimandabile.

### C. Posizione "appresa" per esercente (come `user_rules`) — compagna consigliata
- Tabella `merchant_locations`: esercente (descrizione) → lat, lng, etichetta, `source` (`auto`/`manual`).
- Riempita automaticamente dall'approccio A; l'utente può **correggere/fissare** la posizione di un esercente una volta sola → vale per tutte le sue transazioni.
- Geocodifica **una volta per esercente**, non per transazione: riduce drasticamente costi e complessità.

### Scelta consigliata
**A + C** come nucleo gratuito e a bassa complessità. **B** opzionale in seguito, dietro cache, solo se servirà la precisione stradale.

---

## Resa grafica (stack gratuito)

- **Leaflet** + tile **OpenStreetMap** (open source, gratis; richiede solo l'attribuzione). Da preferire a Mapbox/Google per restare a costo zero.
- **Clustering**: plugin `Leaflet.markercluster` → aggrega/disaggrega automaticamente in base allo zoom. L'icona del cluster può essere personalizzata per mostrare la **somma degli importi** delle transazioni contenute (esattamente la UX richiesta).
- Con base a livello città, molte transazioni condividono lo stesso centroide → il cluster le collassa naturalmente in "Milano €X"; allo zoom si separano se disponibili coordinate più precise (da B/C), altrimenti restano raggruppate sulla città (comunque il comportamento desiderato).

---

## Modello dati

Nuova tabella **`merchant_locations`** (cache per-esercente, niente FK):

```sql
CREATE TABLE IF NOT EXISTS merchant_locations (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT    NOT NULL UNIQUE,   -- esercente (descrizione normalizzata)
  lat         NUMERIC,
  lng         NUMERIC,
  city        TEXT,
  source      TEXT DEFAULT 'auto' CHECK (source IN ('auto', 'manual')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

- La pagina mappa interroga le transazioni del periodo e fa join con `merchant_locations` per descrizione.
- Le transazioni **senza luogo** (bonifici, prelievi, servizi online come Netflix/Amazon) non hanno città → escluse dalla mappa o mostrate in un elenco "senza luogo / online". Comportamento accettabile.
- Alternativa: denormalizzare `lat`/`lng` su `transactions` al momento dell'import. Sconsigliata: duplica il dato e va riempita a posteriori per lo storico; la tabella per-esercente è più pulita.

---

## Componenti da realizzare

**Dati**
- Dataset comuni italiani (JSON/CSV statico nel frontend, o tabella DB) con nome + lat/lng + provincia.
- `docs/migration_*.sql` per `merchant_locations`.

**Backend**
- Servizio di geocodifica: `descrizione → (città, lat, lng)` via gazetteer (estrazione città + lookup).
- `routers/locations.py`: `GET /locations/map?from=&to=` (transazioni geolocalizzate o pre-aggregate per città), `PUT /locations/{merchant}` (correzione manuale).
- Riempimento `merchant_locations` on-demand (al primo caricamento mappa) o batch.

**Frontend**
- Dipendenze: `leaflet` + `leaflet.markercluster` (+ tipi).
- `pages/Mappa.tsx` (nuova voce di navigazione) con selettore periodo coerente con le altre pagine.
- Cluster con somma importi; popup sul marcatore con dettaglio transazioni di quel luogo.
- Piccola UI per correggere la posizione di un esercente sbagliato (sfrutta `merchant_locations.source = 'manual'`).

---

## Fasi suggerite

1. **Fase 1** — gazetteer + servizio di estrazione città + tabella `merchant_locations`. Valore: ogni esercente ottiene una città/coordinate.
2. **Fase 2** — pagina Mappa con Leaflet + OSM + clustering e somma per area. Risolve l'idea base.
3. **Fase 3** — correzione manuale della posizione per esercente (loop semi-automatico: auto-indovina, l'utente aggiusta, si ricorda).
4. **Fase 4 (opzionale)** — geocoding API esterno con cache per precisione stradale.

---

## Decisioni ancora aperte

- Estrazione città: euristica sulla descrizione (gratis, imperfetta) — quanto investire prima di accettare il fallback manuale.
- Dove vive il gazetteer: bundle statico nel frontend vs tabella DB interrogabile.
- Aggregazione: client-side con markercluster (semplice, ok per volumi personali) vs pre-aggregazione per città lato backend (più scalabile).
- Geocoding esterno: se/quando introdurlo, quale provider e con quale policy di cache/attribuzione.
- Transazioni senza luogo: nasconderle o mostrarle in un pannello separato "online / senza luogo".
