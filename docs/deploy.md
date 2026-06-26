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

## Note operative

- **Costo**: Railway $5 credito/mese gratuito — per uso personale con traffico minimo è sufficiente. Vercel e Supabase free tier sono illimitati per uso personale.
- **Logs backend**: Railway dashboard → servizio → **Logs** (in tempo reale).
- **Logs frontend**: Vercel dashboard → **Deployments → Functions**.
- **Cold start**: Railway mantiene il container always-on, nessun cold start.
- **Regione**: Railway US West. Se la latenza verso Supabase fosse un problema, valutare di cambiare regione Railway in modo che coincida con quella del progetto Supabase.
