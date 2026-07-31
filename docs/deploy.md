# Deploy — Finance Tracker

> ## ⚠️ Railway è superato
>
> **Dal 30 luglio 2026 il backend gira su Google Cloud Run**, non più su Railway.
> La guida operativa attuale è **[`deploy_cloudrun.md`](./deploy_cloudrun.md)**.
>
> Questo documento resta valido per **Vercel** (frontend) e **Supabase** (DB + auth), che non sono cambiati.
> Le sezioni su **Railway** sono conservate come riferimento storico e per chi volesse rideployare su Railway: sono contrassegnate come *(storico)* e non descrivono l'ambiente attivo.

## Architettura in produzione

```
Browser
  │
  ├─► Vercel          — frontend React (SPA statica, CDN globale)
  │     URL: https://finance-tracker-six-neon.vercel.app
  │
  ├─► Cloud Run       — backend FastAPI (container scale-to-zero, regione europe-west1 Belgio)
  │     URL: https://finance-tracker-955820740556.europe-west1.run.app
  │     └─► Supabase PostgreSQL  (database)
  │
  └─► Supabase Auth   — JWT emessi al login, validati da FastAPI
```

**Flusso di una chiamata:**
1. Il browser carica i file statici da Vercel (istantaneo, CDN).
2. Ogni chiamata API va su Cloud Run con `Authorization: Bearer <jwt>`.
3. FastAPI valida il JWT con Supabase (`deps.get_current_user`, cache 60 s) e interroga il DB.
4. La risposta torna al browser.

Il passaggio da Railway a Cloud Run ha cambiato solo **dove gira il container**: nessuna modifica al codice, il flusso è identico.

<details>
<summary><b>Architettura precedente (storico, fino a luglio 2026)</b></summary>

```
  ├─► Railway         — backend FastAPI (container always-on, regione europe-west4 Amsterdam)
  │     URL: https://finance-tracker-production-a7c5.up.railway.app
  │     └─► Supabase PostgreSQL  (database)
```

</details>

---

## File nel repo necessari al deploy

| File | Scopo |
|---|---|
| `backend/Dockerfile` | Build del container Python (Cloud Run oggi, Railway prima — invariato) |
| `backend/.dockerignore` | Esclude `tests/` e `.env` dall'immagine |
| `backend/.env.example` | Template variabili d'ambiente backend |
| `frontend/.env.example` | Template variabili d'ambiente frontend |
| `frontend/vercel.json` | Rewrite SPA (evita 404 su refresh di pagina) |

---

## Come è stato fatto il deploy

### 1. Backend

**Oggi: Google Cloud Run.** Procedura completa in **[`deploy_cloudrun.md`](./deploy_cloudrun.md)** — servizio `finance-tracker`, regione `europe-west1`, deploy continuo da GitHub via Developer Connect, build dal Dockerfile con percorso `/backend/Dockerfile`.

> **Se rifai il deploy da zero, la trappola è una sola**: il service account di build (`<project-number>-compute@developer.gserviceaccount.com`) nasce senza permessi e la prima build fallisce in ~19 secondi **senza log**. Ruoli da assegnare e sintomo esatto nella sezione Troubleshooting di [`deploy_cloudrun.md`](./deploy_cloudrun.md#build-fallita-in-pochi-secondi-senza-log).

<details>
<summary><b>1-bis. Railway — backend <i>(storico, non più attivo)</i></b></summary>

1. Creare account su [railway.app](https://railway.app) con **Login via GitHub** (nessuna carta richiesta, $5 di credito gratuito al mese).
2. Dashboard → **New Project → GitHub Repository** → selezionare il repo.
3. Railway rileva automaticamente il repo ma non sa quale cartella buildare. Dopo la creazione del servizio andare in **Settings**:
   - **Root Directory** → `backend`
   - **Build method** → `Dockerfile`
4. Andare in **Variables** e aggiungere:
   ```
   SUPABASE_URL    = https://<project>.supabase.co
   SUPABASE_KEY    = <service-role-key>
   ALLOWED_ORIGINS = https://<dominio>.vercel.app
   ```
   *(aggiornare `ALLOWED_ORIGINS` dopo aver ottenuto il dominio Vercel)*
5. Railway rideploya automaticamente. Verificare su `https://<railway-url>/health` → deve rispondere `{"status":"ok"}`.

> **Nota**: Railway si aggiorna automaticamente ad ogni push su `main`. Non serve CLI né intervento manuale.

</details>

### 2. Vercel — frontend

1. Creare account su [vercel.com](https://vercel.com) con **Login via GitHub** (gratuito, nessuna carta).
2. **Add New Project → Import** il repo `finance-tracker`.
3. Nella schermata di configurazione:
   - **Root Directory** → `frontend`
   - **Framework** → Vite (rilevato automaticamente)
   - **Build Command** → `npm run build`
   - **Output Directory** → `dist`
4. Aggiungere le **Environment Variables**:
   ```
   VITE_SUPABASE_URL      = https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY = <anon-key>
   VITE_API_URL           = https://finance-tracker-955820740556.europe-west1.run.app
   ```
   `VITE_API_URL` va **senza slash finale**: il frontend concatena `${API_URL}/transactions` ([`frontend/src/api/client.ts`](../frontend/src/api/client.ts)).
5. Cliccare **Deploy**. Il dominio assegnato è visibile in Overview → Domains.
6. Aggiornare `ALLOWED_ORIGINS` sul backend con il dominio Vercel definitivo.

> **Nota**: Vercel rideploya automaticamente ad ogni push su `main`. Non serve CLI né intervento manuale.
>
> **Attenzione se cambi `VITE_API_URL`**: Vite *inlinea* le variabili `VITE_*` nel bundle a build time. Modificare la variabile non basta — serve un **Redeploy** (Deployments → ⋯ → Redeploy, togliendo *"Use existing Build Cache"*), altrimenti il sito continua a chiamare il vecchio backend.

### 3. Supabase — redirect URL per reset password

Nel dashboard Supabase → **Authentication → URL Configuration → Allowed Redirect URLs**:
```
https://finance-tracker-six-neon.vercel.app/reset-password
```

---

## Aggiornare l'app in futuro

Basta fare `git push` sul branch `main`:
- **Vercel** rideploya il frontend automaticamente.
- **Cloud Run** rideploya il backend automaticamente (trigger Cloud Build creato da Developer Connect).

Nessuna CLI, nessun intervento manuale.

> Se una build del backend fallisce, i log sono in Cloud Run → servizio → **Cronologia build**, oppure in Cloud Build → Cronologia.

---

## Variabili d'ambiente — riferimento completo

### Cloud Run (backend)
| Variabile | Descrizione |
|---|---|
| `SUPABASE_URL` | URL del progetto Supabase (`https://<project>.supabase.co`) |
| `SUPABASE_KEY` | **Service role key** — bypassa RLS, non esporla mai al client |
| `ALLOWED_ORIGINS` | Dominio Vercel del frontend (CORS), senza slash finale |
| `ENV` | `production` — disattiva `/docs`, `/redoc`, `/openapi.json` e restringe il CORS |
| `LOG_LEVEL` | `INFO` (o `DEBUG`/`WARNING`/`ERROR`) |

Su Railway erano le stesse, senza `ENV` e `LOG_LEVEL`.

### Vercel (frontend)
| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | URL del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | **Anon key** — chiave pubblica, sicura lato client |
| `VITE_API_URL` | URL del backend Cloud Run (senza slash finale) |

---

## Smoke test dopo il deploy

- [ ] Login funziona
- [ ] Le transazioni si caricano (Network tab → header `Authorization` presente)
- [ ] Reset password: ricevere email e completare il flusso su `/reset-password`
- [ ] Importazione di un file CSV va a buon fine
- [ ] Mappa si apre, i marker appaiono, click su marker → sidebar/sheet con transazioni
- [ ] "Arricchisci posizioni" sulla Mappa restituisce un risultato senza errori
- [ ] URL sconosciuto mostra la pagina 404 personalizzata
- [ ] Refresh su `/budget` o `/transactions` non dà 404

---

## Dare l'app a qualcun altro (deploy da zero su account propri)

Questa guida è per chi riceve il repo e vuole deployarlo autonomamente con i propri account.

### Panoramica

Servono 4 account: **GitHub**, **Supabase**, **Vercel** (tutti gratuiti) e un host per il backend — **Google Cloud** (richiede fatturazione attiva, ma per uso personale il costo resta zero) oppure **Railway** ($5 di credito gratuito al mese).  
L'ordine conta: Supabase prima (fornisce le chiavi), poi backend e Vercel (usano quelle chiavi).

Lo Step 3 qui sotto descrive Railway. Per la variante **Cloud Run** — quella in uso oggi — segui [`deploy_cloudrun.md`](./deploy_cloudrun.md) al posto dello Step 3, poi torna qui per lo Step 4.

---

### Step 1 — Copiare il repo su GitHub

1. Aprire il repo originale su GitHub.
2. Cliccare **Fork** in alto a destra → selezionare il proprio account → **Create fork**.
3. Da questo momento lavorare sul proprio fork (non sull'originale).

> In alternativa: **Use this template** se il repo è configurato come template, oppure scaricare lo zip e caricare su un nuovo repo privato.

---

### Step 2 — Supabase (database + autenticazione)

1. Creare account su [supabase.com](https://supabase.com) con **Continue with GitHub**.
2. **New project** → scegliere un nome (es. `finance-tracker`) → scegliere la regione più vicina → impostare una password per il DB (salvarla da qualche parte) → **Create new project**.
3. Aspettare ~2 minuti che il progetto si avvii.
4. Andare in **Project Settings → API** e copiare:
   - **Project URL** → `https://<codice>.supabase.co`
   - **anon public key** → chiave lunga che inizia con `eyJ...`
   - **service_role key** → altra chiave `eyJ...` (tenerla segreta)
5. **Creare le tabelle**: andare in **SQL Editor** ed eseguire nell'ordine gli script presenti in `docs/`:
   - `migration_v2.sql` — crea tutte le tabelle e il seed iniziale
   - `migration_soft_delete.sql` — aggiunge il soft delete su transactions
   - `migration_merchant_locations.sql` — crea la tabella per la geocodifica esercenti (Mappa)
   - `migration_transaction_location_override.sql` — aggiunge le colonne `loc_city/lat/lng` su transactions (Mappa)
   - `migration_rls.sql` — abilita la Row Level Security su tutte le tabelle (blocca l'accesso diretto via anon key; il backend usa la service role e non è impattato)
   - `migration_orig_amount.sql` — aggiunge `orig_amount` su transactions (deduplicazione robusta alle modifiche manuali dell'importo)
6. **Configurare l'autenticazione email**: **Authentication → Providers → Email** → assicurarsi che sia abilitato.
7. **Aggiungere il redirect URL per il reset password**: **Authentication → URL Configuration → Allowed Redirect URLs** → aggiungere:
   ```
   https://<dominio-vercel>.vercel.app/reset-password
   ```
   *(questo si fa dopo aver ottenuto il dominio Vercel al Step 4)*

---

### Step 3 — Railway (backend) *(alternativa storica a Cloud Run)*

> Il deploy attuale usa **Cloud Run**: vedi [`deploy_cloudrun.md`](./deploy_cloudrun.md). Questo step resta per chi preferisce Railway — funziona ancora, il Dockerfile è lo stesso.

1. Creare account su [railway.app](https://railway.app) con **Login with GitHub** (nessuna carta richiesta, $5 di credito gratuito al mese).
2. **New Project → Deploy from GitHub repo** → autorizzare Railway ad accedere al repo → selezionare il fork.
3. Railway crea un servizio. Andare in **Settings** del servizio:
   - **Root Directory** → `backend`
   - **Build method** → `Dockerfile`
4. Andare in **Variables** e aggiungere:
   ```
   SUPABASE_URL    = https://<codice>.supabase.co        ← da Supabase Step 2
   SUPABASE_KEY    = <service_role key>                  ← da Supabase Step 2
   ALLOWED_ORIGINS = https://<dominio-vercel>.vercel.app ← da aggiornare dopo Step 4
   ```
5. Railway fa il deploy automaticamente. Aprire **Settings → Networking → Generate Domain** per ottenere l'URL pubblico (es. `https://finance-tracker-xxxx.up.railway.app`).
6. Verificare che funzioni aprendo `https://<railway-url>/health` → deve rispondere `{"status":"ok"}`.

---

### Step 4 — Vercel (frontend)

1. Creare account su [vercel.com](https://vercel.com) con **Continue with GitHub** (gratuito).
2. **Add New Project → Import Git Repository** → selezionare il fork.
3. Nella schermata di configurazione:
   - **Root Directory** → `frontend`
   - **Framework Preset** → Vite (rilevato automaticamente)
   - **Build Command** → `npm run build`
   - **Output Directory** → `dist`
4. Aggiungere le **Environment Variables**:
   ```
   VITE_SUPABASE_URL      = https://<codice>.supabase.co   ← da Supabase Step 2
   VITE_SUPABASE_ANON_KEY = <anon public key>              ← da Supabase Step 2
   VITE_API_URL           = https://<url-del-backend>            ← da Cloud Run o da Railway Step 5
   ```
   Senza slash finale.
5. Cliccare **Deploy**. Il dominio assegnato è visibile in **Overview → Domains** (es. `https://finance-tracker-xxxx.vercel.app`).

---

### Step 5 — Collegare tutto

Ora che si hanno tutti i domini, due aggiornamenti finali:

**Sul backend** → variabili d'ambiente → aggiornare:
```
ALLOWED_ORIGINS = https://<dominio-vercel>.vercel.app
```
- **Cloud Run**: Console → servizio → *Modifica e distribuisci nuova revisione* → Variabili e secret. Il deploy della nuova revisione parte al salvataggio.
- **Railway**: Variables → il redeploy è automatico.

**Su Supabase** → **Authentication → URL Configuration → Allowed Redirect URLs** → aggiungere:
```
https://<dominio-vercel>.vercel.app/reset-password
```

---

### Smoke test finale

- [ ] Aprire `https://<dominio-vercel>.vercel.app` → schermata di login visibile
- [ ] Registrarsi con un'email → ricevere email di conferma → login funziona
- [ ] Le transazioni si caricano (Network tab → header `Authorization` presente nelle chiamate API)
- [ ] Importare un file CSV o Excel → va a buon fine
- [ ] Reset password: richiedere reset → ricevere email → completare il flusso su `/reset-password`
- [ ] Mappa si apre, "Arricchisci posizioni" funziona senza errori
- [ ] Refresh su `/budget` o `/transactions` non dà 404
- [ ] URL sconosciuto mostra la pagina 404 personalizzata

---

## Note operative

- **Costo**: Cloud Run free tier (2M richieste/mese) con `min-instances=0` → di fatto **zero** per uso personale; `max-instances=3` come paracadute. Vercel e Supabase free tier sono illimitati per uso personale. *(Storico: Railway dava $5 di credito/mese, sufficienti per traffico minimo.)*
- **Logs backend**: Cloud Run → servizio → **Osservabilità → Log** (in tempo reale), o `gcloud run services logs read finance-tracker --region europe-west1`. *(Storico: Railway dashboard → servizio → Logs.)*
- **Logs frontend**: Vercel dashboard → **Deployments → Functions**.
- **Cold start**: Cloud Run scala a zero, quindi la **prima richiesta dopo un periodo di inattività** paga l'avvio del container (qualche secondo, deve caricare pandas). È il compromesso per restare nel free tier; si elimina con `--min-instances=1` a fronte di un piccolo costo mensile. *(Storico: Railway era always-on, nessun cold start.)*
- **Backup**: il free tier Supabase non ha backup automatici — è attivo un backup settimanale via repo GitHub privato `finance-tracker-backup`; procedura e restore in [`docs/backup.md`](./backup.md).
- **Regione**: Cloud Run **europe-west1 (Belgio)**, vicina alle region Supabase EU. Il criterio è la vicinanza a **Supabase**, non all'utente: il browser contatta il backend una volta per richiesta, il backend interroga Supabase N volte. La regione **non è modificabile** dopo la creazione del servizio. *(Storico: Railway europe-west4 Amsterdam, spostata a luglio 2026 da US West per eliminare la latenza transatlantica.)*
