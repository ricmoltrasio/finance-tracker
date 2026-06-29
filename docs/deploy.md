# Deploy — Finance Tracker

## Architettura in produzione

```
Browser
  │
  ├─► Vercel          — frontend React (SPA statica, CDN globale)
  │     URL: https://finance-tracker-six-neon.vercel.app
  │
  ├─► Railway         — backend FastAPI (container always-on, regione US West)
  │     URL: https://finance-tracker-production-a7c5.up.railway.app
  │     └─► Supabase PostgreSQL  (database)
  │
  └─► Supabase Auth   — JWT emessi al login, validati da FastAPI
```

**Flusso di una chiamata:**
1. Il browser carica i file statici da Vercel (istantaneo, CDN).
2. Ogni chiamata API va su Railway con `Authorization: Bearer <jwt>`.
3. FastAPI valida il JWT con Supabase (`deps.get_current_user`, cache 60 s) e interroga il DB.
4. La risposta torna al browser.

---

## File nel repo necessari al deploy

| File | Scopo |
|---|---|
| `backend/Dockerfile` | Build del container Python per Railway |
| `backend/fly.toml` | Non usato (rimasto da setup iniziale con Fly.io) |
| `backend/.env.example` | Template variabili d'ambiente backend |
| `frontend/.env.example` | Template variabili d'ambiente frontend |
| `frontend/vercel.json` | Rewrite SPA (evita 404 su refresh di pagina) |

---

## Come è stato fatto il deploy

### 1. Railway — backend

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
   VITE_API_URL           = https://<railway-url>.up.railway.app
   ```
5. Cliccare **Deploy**. Il dominio assegnato è visibile in Overview → Domains.
6. Tornare su Railway e aggiornare `ALLOWED_ORIGINS` con il dominio Vercel definitivo.

> **Nota**: Vercel rideploya automaticamente ad ogni push su `main`. Non serve CLI né intervento manuale.

### 3. Supabase — redirect URL per reset password

Nel dashboard Supabase → **Authentication → URL Configuration → Allowed Redirect URLs**:
```
https://finance-tracker-six-neon.vercel.app/reset-password
```

---

## Aggiornare l'app in futuro

Basta fare `git push` sul branch `main`:
- **Vercel** rideploya il frontend automaticamente.
- **Railway** rideploya il backend automaticamente.

Nessuna CLI, nessun intervento manuale.

---

## Variabili d'ambiente — riferimento completo

### Railway (backend)
| Variabile | Descrizione |
|---|---|
| `SUPABASE_URL` | URL del progetto Supabase (`https://<project>.supabase.co`) |
| `SUPABASE_KEY` | **Service role key** — bypassa RLS, non esporla mai al client |
| `ALLOWED_ORIGINS` | Dominio Vercel del frontend (CORS) |

### Vercel (frontend)
| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | URL del progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | **Anon key** — chiave pubblica, sicura lato client |
| `VITE_API_URL` | URL del backend Railway |

---

## Smoke test dopo il deploy

- [ ] Login funziona
- [ ] Le transazioni si caricano (Network tab → header `Authorization` presente)
- [ ] Reset password: ricevere email e completare il flusso su `/reset-password`
- [ ] Importazione di un file CSV va a buon fine
- [ ] URL sconosciuto mostra la pagina 404 personalizzata
- [ ] Refresh su `/budget` o `/transactions` non dà 404

---

## Dare l'app a qualcun altro (deploy da zero su account propri)

Questa guida è per chi riceve il repo e vuole deployarlo autonomamente con i propri account.

### Panoramica

Servono 3 account gratuiti: **GitHub**, **Supabase**, **Railway**, **Vercel**.  
L'ordine conta: Supabase prima (fornisce le chiavi), poi Railway e Vercel (usano quelle chiavi).

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
5. **Creare le tabelle**: andare in **SQL Editor** ed eseguire nell'ordine i due script presenti in `docs/`:
   - `migration_v2.sql` — crea tutte le tabelle e il seed iniziale
   - `migration_soft_delete.sql` — aggiunge il soft delete su transactions
6. **Configurare l'autenticazione email**: **Authentication → Providers → Email** → assicurarsi che sia abilitato.
7. **Aggiungere il redirect URL per il reset password**: **Authentication → URL Configuration → Allowed Redirect URLs** → aggiungere:
   ```
   https://<dominio-vercel>.vercel.app/reset-password
   ```
   *(questo si fa dopo aver ottenuto il dominio Vercel al Step 4)*

---

### Step 3 — Railway (backend)

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
   VITE_API_URL           = https://<railway-url>.up.railway.app ← da Railway Step 5
   ```
5. Cliccare **Deploy**. Il dominio assegnato è visibile in **Overview → Domains** (es. `https://finance-tracker-xxxx.vercel.app`).

---

### Step 5 — Collegare tutto

Ora che si hanno tutti i domini, due aggiornamenti finali:

**Su Railway** → **Variables** → aggiornare:
```
ALLOWED_ORIGINS = https://<dominio-vercel>.vercel.app
```
Railway fa il redeploy automaticamente.

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
- [ ] Refresh su `/budget` o `/transactions` non dà 404
- [ ] URL sconosciuto mostra la pagina 404 personalizzata

---

## Note operative

- **Costo**: Railway $5 credito/mese gratuito — per uso personale con traffico minimo è sufficiente. Vercel e Supabase free tier sono illimitati per uso personale.
- **Logs backend**: Railway dashboard → servizio → **Logs** (in tempo reale).
- **Logs frontend**: Vercel dashboard → **Deployments → Functions**.
- **Cold start**: Railway mantiene il container always-on, nessun cold start.
- **Regione**: Railway US West. Se la latenza verso Supabase fosse un problema, valutare di cambiare regione Railway in modo che coincida con quella del progetto Supabase.
