# Deploy — Finance Tracker

## Architettura in produzione

```
Browser
  │
  ├─► Vercel          — frontend React (SPA statica, CDN globale)
  │
  ├─► Fly.io          — backend FastAPI (container, regione mxp - Milano)
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

## File già presenti nel repo

| File | Stato | Note |
|---|---|---|
| `backend/Dockerfile` | ✅ pronto | Python 3.12-slim, porta 8080 |
| `backend/fly.toml` | ✅ pronto | regione `mxp`, 256 MB RAM, `ENV=production` |
| `backend/.env.example` | ✅ pronto | template variabili backend |
| `frontend/.env.example` | ✅ pronto | template variabili frontend |
| `frontend/vercel.json` | ✅ pronto | rewrite SPA (evita 404 su refresh) |

---

## Passi per il deploy (in ordine)

### 1. Supabase — configurazione redirect URL

Nel dashboard Supabase → **Authentication → URL Configuration**:
- Aggiungere agli **Allowed Redirect URLs**: `https://<dominio>.vercel.app/reset-password`

Senza questo il link nell'email di reset password non funziona in produzione.

### 2. Fly.io — primo deploy backend

```bash
# Installare la CLI se non presente
# https://fly.io/docs/flyctl/install/

cd backend

# Solo la prima volta: crea l'app su Fly (usa il fly.toml esistente)
fly launch --no-deploy

# Impostare i secrets (non vanno nel fly.toml né nel repo)
fly secrets set \
  SUPABASE_URL=https://<project>.supabase.co \
  SUPABASE_KEY=<service-role-key> \
  ALLOWED_ORIGINS=https://<dominio>.vercel.app

# Deploy
fly deploy
```

Per i deploy successivi basta `fly deploy` dalla cartella `backend/`.

### 3. Vercel — frontend

- Collegare il repo GitHub a Vercel (vercel.com → Add New Project).
- Impostare:
  - **Root directory**: `frontend`
  - **Build command**: `npm run build`
  - **Output directory**: `dist`
- Aggiungere le **Environment Variables** nel dashboard Vercel:

```
VITE_SUPABASE_URL      = https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY = <anon-key>
VITE_API_URL           = https://<app-name>.fly.dev
```

> `VITE_SUPABASE_ANON_KEY` è la chiave pubblica (anon) — è sicura lato client.
> `SUPABASE_KEY` sul backend è la *service role* — non esporla mai al browser.

### 4. Smoke test dopo il deploy

- [ ] Login funziona
- [ ] Una transazione si carica (Network tab → header `Authorization` presente)
- [ ] Reset password: ricevere email e completare il flusso su `https://<dominio>.vercel.app/reset-password`
- [ ] Importazione di un file CSV va a buon fine
- [ ] URL sconosciuto mostra la pagina 404 personalizzata

---

## Database

Se è un progetto nuovo (DB vuoto), eseguire nel **SQL Editor di Supabase**:

1. [`docs/migration_v2.sql`](./migration_v2.sql) — schema completo (tabelle, indici, seed categorie)
2. [`docs/migration_soft_delete.sql`](./migration_soft_delete.sql) — colonna `deleted_at` per il soft-delete

Se il DB esiste già dalla fase locale, solo il punto 2 se non ancora eseguito.

---

## Note operative

- **Regione**: Fly.io in `mxp` (Milano). Scegliere la stessa regione del progetto Supabase per minimizzare la latenza backend → DB.
- **Cold start**: la configurazione attuale (`auto_stop_machines = true`, `min_machines_running = 0`) spegne la macchina dopo inattività (~5 min). La prima richiesta dopo un periodo di idle impiega ~3–5 s. Per uso personale è accettabile e mantiene il costo a zero su Fly.io free tier. Per evitarlo: impostare `auto_stop_machines = false` e `min_machines_running = 1` (~$2/mese).
- **Logs**: `fly logs` per i log in tempo reale, `fly status` per lo stato della macchina.
- **Aggiornamento backend**: `fly deploy` dalla cartella `backend/` dopo ogni modifica.
- **Aggiornamento frontend**: push su GitHub → Vercel rideploya automaticamente.
