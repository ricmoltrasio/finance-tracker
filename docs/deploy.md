# Deploy — Finance Tracker

## Architettura in produzione

```
Browser
  │
  ├─► Vercel          — frontend React (SPA statica, CDN globale)
  │
  ├─► Fly.io          — backend FastAPI (container always-on, regione fra)
  │     └─► Supabase PostgreSQL  (database)
  │
  └─► Supabase Auth   — JWT emessi al login, validati da FastAPI
```

**Flusso di una chiamata:**
1. Il browser carica i file statici da Vercel (istantaneo, CDN).
2. Ogni chiamata API va su Fly.io con `Authorization: Bearer <jwt>`.
3. FastAPI valida il JWT con Supabase (`deps.get_current_user`, cache 60 s) e interroga il DB.
4. La risposta torna al browser.

---

## Cosa manca per il deploy

### 1. File da creare (backend)

**`backend/Dockerfile`**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**`fly.toml`** (nella root del progetto o in `backend/`)
```toml
app = "finance-tracker-api"
primary_region = "fra"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false   # always-on, evita cold start
  auto_start_machines = true
  min_machines_running = 1

[env]
  ENV = "production"
  LOG_LEVEL = "INFO"
```

### 2. Configurazione Supabase (dashboard)

- **Redirect URLs** → `Authentication → URL Configuration`
  Aggiungere: `https://<dominio-vercel>.vercel.app/reset-password`
- **RLS** → verificare che tutte le tabelle abbiano Row Level Security abilitata
  con policy `auth.uid() = user_id` (bloccante se l'app è multi-utente).

### 3. Variabili d'ambiente

**Fly.io — secrets** (impostati con `fly secrets set KEY=value`):
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service-role-key>
ALLOWED_ORIGINS=https://<dominio-vercel>.vercel.app
ENV=production
```

**Vercel — environment variables** (dashboard → Settings → Environment Variables):
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=https://<app-name>.fly.dev
```

---

## Passi per il deploy (in ordine)

1. **Supabase** — aggiungere il redirect URL e verificare RLS (vedi sopra).
2. **Fly.io backend**
   ```bash
   # dalla cartella backend/
   fly launch          # crea l'app su Fly, genera fly.toml se non esiste
   fly secrets set SUPABASE_URL=... SUPABASE_KEY=... ALLOWED_ORIGINS=... ENV=production
   fly deploy
   ```
3. **Vercel frontend**
   - Collegare il repo GitHub a Vercel (o `vercel deploy` da CLI).
   - Impostare le tre variabili d'ambiente nel dashboard.
   - Root directory: `frontend`, build command: `npm run build`, output: `dist`.
4. **Smoke test**
   - Login funziona.
   - Una chiamata API va a buon fine (controllare Network tab → `Authorization` header presente).
   - Reset password: ricevere l'email e completare il flusso.

---

## Note operative

- **Regione**: Fly.io in `fra` (Frankfurt) deve coincidere con la regione del progetto Supabase per minimizzare la latenza backend → DB.
- **Costo stimato**: Fly.io shared-cpu-1x always-on ~$2/mese. Vercel e Supabase free tier sono sufficienti per uso personale.
- **Logs Fly.io**: `fly logs` per vedere i log in tempo reale.
- **Aggiornamento backend**: `fly deploy` dalla cartella `backend/` dopo ogni modifica.
- **`SUPABASE_KEY`** è la *service role key* (bypassa RLS) — non esporla mai lato client e non committarla nel repo.
