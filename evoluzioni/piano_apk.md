# Piano — App mobile (APK) standalone su Supabase

## Contesto e obiettivo

Oggi l'app dipende da **tre** servizi in cloud: Vercel (hosting frontend), Railway (backend FastAPI, ~5 €/mese), Supabase (DB + Auth). L'obiettivo è avere un'**app Android installabile (APK)** che dipenda **solo da Supabase**, eliminando Railway e Vercel.

**Motivazione:** togliere il costo/dipendenza di Railway (il trial è scaduto → piano Hobby a pagamento), avere l'app installata sul telefono senza passare dalla PWA ospitata, ridurre le parti mobili a una sola (Supabase, che ha free tier adeguato al single-user).

**Vincolo:** la versione live attuale **non va toccata** finché la nuova non è pronta. Vercel e Railway deployano **solo dal branch `main`**, quindi tutto il lavoro va su un contenitore separato (vedi § Isolamento).

> **Nota sul modello mentale.** Non è "il backend che gira sul telefono". Un telefono non fa girare FastAPI. In target il backend **sparisce come processo**: le sue responsabilità (categorizzazione, dedup, parsing, geocodifica, aggregazioni, audit) diventano **codice client eseguito on-device**. L'app diventa un **fat client** che parla direttamente all'API gestita di Supabase (PostgREST + Auth). In cloud resta **solo Supabase**.

---

## Architettura: oggi vs target

```
OGGI
  App (PWA/browser) ──HTTP──► Backend FastAPI (Railway) ──► Supabase (Postgres + Auth)
       │  Supabase solo per login (JWT)               usa la SERVICE KEY (bypassa RLS)
       └──────────────────────────────────────────► Supabase Auth

TARGET (Opzione 2)
  App nativa (APK, logica a bordo) ──supabase-js (ANON KEY + JWT)──► Supabase (Postgres + Auth)
       └── categorizza, deduplica, parsa i file, geocodifica,        la RLS decide cosa è permesso
           aggrega saldo/summary (via RPC), scrive l'audit … on-device
```

**Il "cardine" della migrazione** è la cartella [frontend/src/api/](../frontend/src/api/): tutti gli hook (`src/hooks/`) e le pagine chiamano **solo** questi moduli (`transactions.ts`, `categories.ts`, `import.ts`, `settings.ts`, `locations.ts`, `client.ts`). Se si **reimplementano quei moduli mantenendo le stesse firme** ma facendoli parlare con `supabase-js` invece che col backend, **UI, hook e componenti restano invariati**. È questo che rende la migrazione circoscritta.

---

## Strategia a due tappe

Si separano i due problemi (impacchettare vs riscrivere) per non bloccarsi:

- **Tappa 1 — APK col backend attuale.** Impacchettare il frontend com'è (che chiama Railway) in un APK con Capacitor, installarlo sul telefono, verificare che login e dati funzionino da app nativa. **Nessuna logica da riscrivere.** Serve a imparare build+install e a validare il guscio nativo.
- **Tappa 2 — Solo Supabase.** Reimplementare il data-layer su `supabase-js`, scrivere le policy RLS, portare la logica del backend nel client. Quando funziona: rebuild dell'APK e **spegnimento di Railway**.

Si può fermarsi alla Tappa 1 e restare col backend (magari spostato su un host gratuito tipo Cloud Run) se la Tappa 2 sembra troppo. Le due tappe sono indipendenti.

---

## Isolamento: come tenere separate le due versioni

Vercel/Railway toccano **solo `main`**, quindi qualunque contenitore diverso da `main` lascia la produzione intatta.

| Approccio | Come | Note |
|---|---|---|
| **Repo separato** (consigliato) | `finance-tracker-mobile` nuovo, clone di questo | Isolamento totale: storia, deploy, issue separati. Zero rischio sull'originale |
| **Branch locale** | `git switch -c mobile-standalone`, tenuto **locale** | `main` intatto. Se si *pusha* il branch, Vercel può creare un preview deployment (URL separato, innocuo) — per evitarlo tenerlo locale o disattivare i preview su Vercel |

Consiglio: **repo separato**. Il codice parte identico; da lì diverge senza toccare l'app funzionante. La chiusura del backend Railway avverrà solo alla fine, consapevolmente.

---

## TAPPA 1 — APK con Capacitor (backend invariato)

**Perché Capacitor e non una TWA:** Capacitor impacchetta i file buildati *dentro* l'APK (l'app si carica in locale, niente dipendenza da Vercel per servire il frontend). Una TWA/Bubblewrap wrapperebbe solo la PWA ospitata → resterebbe legata a Vercel.

### Prerequisiti (una tantum)
- **Android Studio** (include l'Android SDK) + un **JDK** (quello incluso in Android Studio va bene).
- Node/npm già presenti.

### Setup nel progetto (frontend/)
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Finance Tracker" com.moltrasio.financetracker --web-dir dist
npm install @capacitor/android
npx cap add android
```
Questo crea `capacitor.config.ts` e la cartella nativa `android/`.

### Build e sincronizzazione
```bash
npm run build        # genera dist/ (Vite)
npx cap sync         # copia dist/ nel progetto Android + aggiorna i plugin
npx cap open android # apre Android Studio
```
> Ogni volta che si modifica il frontend: `npm run build && npx cap sync`, poi rebuild in Android Studio.

### Installare sul telefono (due modi)
1. **Via cavo (più semplice per provare):** attivare *Opzioni sviluppatore → Debug USB* sul telefono, collegarlo, premere **Run ▶** in Android Studio → l'app si installa e parte sul dispositivo.
2. **APK da condividere:** *Build → Build APK(s)* → si ottiene `app-debug.apk` (in `android/app/build/outputs/apk/debug/`). Trasferirlo sul telefono (Drive/cavo/`adb install`) e installarlo abilitando "installa da origini sconosciute".

Per un APK **release firmato** serve una chiave (`keytool` → keystore, poi *Build → Generate Signed Bundle/APK*). Per uso personale l'APK debug è sufficiente.

### Accorgimenti Tappa 1
- Le env `VITE_*` vengono **incluse nel bundle** al build: assicurarsi che `.env` (in `frontend/`) contenga `VITE_API_URL` = URL Railway, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **CORS/Origin:** in Capacitor l'app gira da un origin tipo `https://localhost` / `capacitor://localhost`. Le chiamate al backend Railway devono essere permesse → aggiungere questi origin a `ALLOWED_ORIGINS` su Railway (oltre al dominio Vercel).
- Icona/splash (opzionale): `@capacitor/assets` per generarle dal logo.

### Verifica Tappa 1
- L'app si apre nativamente, login OK, transazioni/mappa/import funzionano identici alla PWA.
- Refresh/riavvio app: la sessione Supabase persiste (localStorage nel webview).

---

## TAPPA 2 — Solo Supabase (fat client, niente backend)

### 2a. Sicurezza: policy RLS (PRIMA di tutto)
Oggi la RLS è **abilitata senza policy** (`migration_rls.sql`) → la anon key è murata. Con l'accesso diretto dal client la anon key (inclusa nell'APK, pubblica per design) diventa la chiave d'ingresso: **le policy RLS sono l'unica difesa**. Essendo **single-user**, il modello è semplice: l'utente **autenticato** può tutto, l'anon (non loggato) niente.

Nuova migration (es. `docs/migration_mobile_rls.sql`):
```sql
-- Accesso diretto client per l'utente AUTENTICATO (single-user).
-- La RLS è già ON; qui si aggiungono le policy mancanti.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions','categories','split_items','import_profiles',
    'settings','user_rules','audit_log','merchant_locations'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "auth full access" ON public.%I '
      'FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
  END LOOP;
END $$;
```
> La **service key non deve MAI** finire nell'app (solo la anon key). La service key resta usata **solo** dallo script di backup su GitHub Actions, che continua a funzionare a parte.
>
> Se un giorno servisse il **multi-utente**, aggiungere una colonna `user_id uuid` e cambiare le policy in `USING (user_id = auth.uid())`. Fuori scope ora.

### 2b. Data layer: reimplementare `src/api/*` su supabase-js
Mantenendo **identiche le firme** delle funzioni esportate (così hook e UI non cambiano):
- Sostituire `apiFetch`/`apiUpload` di [client.ts](../frontend/src/api/client.ts) con chiamate `supabase.from(...)` / `supabase.rpc(...)`.
- `transactions.ts`, `categories.ts`, `settings.ts`, `locations.ts`, `import.ts` → reimplementati sul client.
- Rimuovere la dipendenza da `VITE_API_URL`.

### 2c. Port della logica dal backend (inventario)
| Cosa fa oggi il backend | Equivalente client (Tappa 2) |
|---|---|
| CRUD transazioni, deleted, restore, soft-delete | `supabase.from('transactions')` con `.select/.insert/.update`; soft-delete = update `deleted_at`; filtri via query builder |
| **Summary / Timeline** (saldo cumulativo dal `saldo_iniziale`) | **Funzioni Postgres RPC** (`rpc_summary`, `rpc_timeline`) invocate con `supabase.rpc(...)`: il cumulativo va calcolato in SQL, non scaricando tutte le righe |
| **Mappa** (`/locations/map`, aggregato per città) | RPC `rpc_map_locations(from,to,descriptions)` oppure query + aggregazione client |
| **Categorizzazione** (user_rules → soglia stipendio → keyword income/expense) | Porto in TS: logica semplice; keyword lette dalla tabella `categories`, regole da `user_rules` |
| **Deduplicazione** (date + descr normalizzata + `orig_amount` arrotondato) | Porto in TS al momento dell'import; confronto con righe esistenti (incluse soft-deleted) via query |
| **Parsing import** (pandas/openpyxl, 7 formati data, single/dare_avere, auto-detect banca) | **SheetJS** (`xlsx`) per XLSX + **PapaParse** per CSV; riscrivere il mapping colonne/date/importi in TS |
| **Geocodifica** (gazetteer `comuni.json` + Nominatim, per esercente) | Bundle di `comuni.json` nell'app + chiamate a Nominatim via **HTTP nativo Capacitor** (per impostare lo `User-Agent` richiesto e bypassare i limiti fetch del webview); scrittura in `merchant_locations` |
| **Audit log** | `supabase.from('audit_log').insert(...)` dal client |
| **Ricategorizzazione massiva** (recategorize-all/uncategorized) | Fetch righe + categorizza in TS + update in batch |
| Rate limiting (slowapi) | Eliminato: irrilevante per single-user |

### 2d. Operazioni atomiche → RPC Postgres
Lo **split** e altre operazioni multi-riga oggi non sono transazionali (Supabase REST). Per renderle sicure, incapsularle in **funzioni Postgres** (`plpgsql`) invocate con `supabase.rpc('split_transaction', ...)`: la funzione fa insert delle parti + set `is_split` in un'unica transazione SQL.

### 2e. Auth e reset password
- Login email+password: già gestito da `supabase-js`, funziona nativamente.
- **Reset password** via link email che riapre l'app: richiede un **deep link** (schema custom o App Link) + configurazione dei *Redirect URL* in Supabase. Rimandabile: all'inizio il reset si può gestire aprendo il link nel browser.

### 2f. Chiamate esterne dal nativo
Per Nominatim (e in generale per non incappare in CORS/limiti del webview) usare il plugin **HTTP nativo** di Capacitor (`@capacitor/core` Http o `@capacitor-community/http`), che permette header custom (`User-Agent`) e chiamate cross-origin dirette. Le chiamate a Supabase le fa `supabase-js` senza problemi.

### 2g. Spegnere Railway
Quando la Tappa 2 è verificata: rimuovere/spegnere il servizio Railway. Aggiornare la documentazione ([docs/deploy.md](../docs/deploy.md), [docs/README.md](../docs/README.md)) per riflettere l'architettura "solo Supabase". Il backup settimanale (service key su GitHub Actions) resta invariato.

---

## Caveat e trade-off
- **Sicurezza tutta sulla RLS:** con la anon key nell'APK, un errore nelle policy espone i dati. Va fatta con attenzione (per single-user è semplice, ma va fatta).
- **Enrich geocodifica on-device:** a 1 req/s verso Nominatim un enrich massiccio è lento → eseguirlo in background nell'app; si fa raramente.
- **Import file grossi:** il parsing gira sulla CPU del telefono; per estratti conto normali nessun problema.
- **Niente più layer API riutilizzabile:** un eventuale secondo client (web) dovrebbe riparlare diretto a Supabase o reintrodurre un backend. Per un'unica app mobile personale non è un problema.
- **Perdita di logica "server-only":** eventuali future esigenze (webhook, job schedulati) richiederebbero Supabase Edge Functions.

---

## Verifica end-to-end

**Tappa 1:** APK installato; login, lista/summary/timeline, mappa, import CSV/XLSX, correzione posizione, split — tutti funzionanti come nella PWA; sessione persistente al riavvio.

**Tappa 2 (in aggiunta):**
- Con backend Railway **spento**, l'app fa tutto parlando solo con Supabase.
- Prova RLS: senza login la anon key non legge nulla; con login l'utente opera normalmente.
- Import completo (parse → categorizza → deduplica → geocodifica → insert) tutto client-side, con dedup che continua a evitare i duplicati al re-import.
- Split scritto atomicamente (RPC): niente transazioni "divise senza parti".
- Audit log popolato dalle azioni sensibili.

---

## Ordine consigliato (checklist)

1. [ ] Creare il **contenitore separato** (repo `finance-tracker-mobile` o branch locale).
2. [ ] **Tappa 1:** setup Capacitor + primo APK sul telefono (backend Railway invariato) + `ALLOWED_ORIGINS` aggiornato.
3. [ ] **RLS** (2a): scrivere ed eseguire `migration_mobile_rls.sql` su Supabase.
4. [ ] **RPC** (2c/2d): creare le funzioni Postgres per summary/timeline/mappa e per lo split atomico.
5. [ ] **Data layer** (2b): reimplementare `src/api/*` su `supabase-js`, a firme invariate.
6. [ ] **Port logica** (2c): categorizer, deduplicator, parser (SheetJS/PapaParse), geocoder (comuni.json + Nominatim via HTTP nativo), audit.
7. [ ] **Auth/reset** (2e): login ok; deep link per il reset (opzionale, rimandabile).
8. [ ] **Verifica** end-to-end con Railway spento.
9. [ ] **Spegnere Railway** (2g) + aggiornare la documentazione.

> Ci si può fermare al punto 2 (APK col backend) in qualsiasi momento: già così l'app è installabile sul telefono. I punti 3→9 sono la parte "solo Supabase".
