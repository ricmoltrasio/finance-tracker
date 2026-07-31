# Deploy backend su Google Cloud Run — Finance Tracker

> **Stato: in produzione dal 30 luglio 2026.** Il backend gira su Cloud Run. Railway è **superato** — la sua configurazione resta documentata in [`deploy.md`](./deploy.md) per riferimento storico, ma non è più l'ambiente attivo.

Guida al deploy del **backend FastAPI** su **Google Cloud Run**, come effettivamente eseguito (Console GUI + Developer Connect).

> **Cosa va su Cloud Run:** solo il **backend** (è un container). Il **frontend** è una SPA statica e resta su **Vercel**. Il database e l'auth restano su **Supabase**.

---

## Architettura in produzione

```
Browser
  │
  ├─► Vercel          — frontend React (SPA statica, CDN globale)
  │     URL: https://finance-tracker-six-neon.vercel.app
  │
  ├─► Cloud Run       — backend FastAPI (container, regione europe-west1 Belgio)
  │     URL: https://finance-tracker-955820740556.europe-west1.run.app
  │     └─► Supabase PostgreSQL  (database)
  │
  └─► Supabase Auth   — JWT emessi al login, validati da FastAPI
```

Rispetto a Railway cambia solo **dove gira il container**: il flusso di una chiamata è identico (browser → API con `Authorization: Bearer <jwt>` → FastAPI valida il JWT con Supabase → interroga il DB).

### Configurazione effettiva

| Parametro | Valore |
|---|---|
| Progetto GCP | `My First Project` — project number `955820740556` |
| Servizio | `finance-tracker` |
| Regione | `europe-west1` (Belgio) — **non modificabile dopo la creazione** |
| Autenticazione | **Consenti accesso pubblico** (allow unauthenticated) |
| Porta container | `8080` |
| Scalabilità | min `0`, max `3` |
| Memoria consigliata | `1 GiB` (il default 512 MiB è stretto: `pandas` + `openpyxl` durante l'import) |
| Deploy | continuo da GitHub (`main`) via Developer Connect |

**Perché europe-west1 e non Milano:** quello che conta è la vicinanza a **Supabase**, non all'utente — il browser parla con Cloud Run una volta per richiesta, Cloud Run parla con Supabase N volte. Il Belgio è vicino alle region Supabase EU (Irlanda/Francoforte) ed è tier 1, leggermente più economico di `europe-west8` (Milano).

---

## Perché funziona senza modifiche al codice

| Vincolo Cloud Run | Stato nel progetto |
|---|---|
| Il container deve ascoltare su `$PORT` (default **8080**) | Il [`Dockerfile`](../backend/Dockerfile) ascolta già su `8080` → combacia con il default di Cloud Run |
| Config solo da variabili d'ambiente (niente `.env`) | `db/supabase.py` usa `os.environ`; `load_dotenv()` è un no-op se il file manca → bastano le env var del servizio |
| Dietro un proxy: IP reale del client da `X-Forwarded-For` | Il CMD ha già `--proxy-headers --forwarded-allow-ips "*"` → rate limiting e IP dell'audit log restano corretti |
| `ENV=production` disattiva `/docs`, `/redoc`, `/openapi.json` e restringe il CORS | Gestito in `main.py` in base a `ENV` |

Il `.env` non finisce mai nell'immagine: è escluso dal [`.dockerignore`](../backend/.dockerignore) ed è in `.gitignore`, quindi non è nemmeno nel repo da cui builda Cloud Build.

> Miglioria opzionale (non necessaria): rendere il CMD robusto a una porta diversa da 8080 →
> `CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips "*"`
> (forma shell, così `$PORT` viene espansa). Con la porta di default attuale non serve.

---

## Prerequisiti

Un **account Google Cloud** con un **progetto** e la **fatturazione attiva**. Cloud Run la richiede anche per restare nel free tier (2M richieste/mese incluse): per uso personale è di fatto gratuito.

---

## Percorso A — Deploy da Console (quello usato)

### 1. Crea servizio

Console → **Cloud Run** → **Crea servizio** → **Developer Connect** (non "Cloud Build").

Nella schermata iniziale:
- **Nome servizio**: `finance-tracker`
- **Regione**: `europe-west1` — sceglila con attenzione, **non è modificabile dopo**
- **Autenticazione**: **Consenti accesso pubblico** ← critico

> **Sull'autenticazione**: l'auth la fa FastAPI con il JWT Supabase, non IAM di Google. Con "Richiedi autenticazione" Google blocca *tutte* le richieste prima che arrivino all'app: ogni chiamata, login compreso, risponderebbe `403`.

### 2. Configura con Developer Connect

Collega GitHub → repo → branch **`main`**. Poi, nella configurazione di build:

- **Tipo di build**: **Dockerfile** (non Buildpacks)
- **Percorso Dockerfile**: **`/backend/Dockerfile`** ← il punto dove è facile sbagliare
- se compare un campo separato per la **directory di compilazione** / build context: **`/backend`**

**Perché conta:** il Dockerfile non è alla root del repo e fa `COPY requirements.txt .`, che è relativo al build context. Se il context resta la root del repo la build fallisce con `requirements.txt: not found`.

Al primo utilizzo la Console chiede di abilitare le API necessarie (Cloud Build, Developer Connect, Artifact Registry, Container Analysis, IAM): accetta.

### 3. Permessi IAM del service account di build ⚠️

**Questo è il passaggio che fa fallire il primo deploy.** Vedi [Troubleshooting](#build-fallita-in-pochi-secondi-senza-log) per il sintomo esatto.

Console → **IAM e amministrazione → IAM** → spunta in alto a destra **"Includi concessioni di ruoli fornite da Google"** (altrimenti il service account non compare) → trova:

```
955820740556-compute@developer.gserviceaccount.com
```

Matita **Modifica entità** → assegna questi ruoli:

| Ruolo | Serve per |
|---|---|
| **Logs Writer** | Scrivere i log di build — senza, la build muore subito e **senza lasciare traccia** |
| **Artifact Registry Writer** | Pushare l'immagine costruita |
| **Cloud Build Service Account** | Bucket di staging usato da Cloud Build per source e artefatti |
| **Cloud Run Admin** | Il passaggio finale di deploy (`gcloud run services update`) |
| **Service Account User** | Impersonare il service account con cui girerà il servizio |
| **Developer Connect Read Token Accessor** | Leggere il repo GitHub collegato |

Dopo il salvataggio aspetta ~1 minuto: la propagazione IAM non è istantanea.

### 4. Variabili d'ambiente

Sezione **Container(s), volumi, networking, sicurezza** → tab **Variabili e secret**. In GUI si aggiungono una alla volta, quindi le virgole nei valori non sono un problema (a differenza di `--set-env-vars` da CLI).

| Nome | Valore |
|---|---|
| `ENV` | `production` |
| `LOG_LEVEL` | `INFO` |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_KEY` | la **service role key** (bypassa la RLS, tenere segreta) |
| `ALLOWED_ORIGINS` | `https://finance-tracker-six-neon.vercel.app` |

`ALLOWED_ORIGINS` è il dominio **Vercel del frontend**, non l'URL di Cloud Run, e deve essere esatto — **senza slash finale**, altrimenti il CORS blocca tutto.

Nella stessa sezione: **porta 8080** (non toccare, è hardcoded nel Dockerfile), **memoria 1 GiB**, **CPU allocata solo durante le richieste**, **min istanze 0**, **max istanze 3**.

---

## Percorso B — Deploy da CLI (alternativa)

Con il [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installato, oppure da **Cloud Shell** (icona `>_` nella console, `gcloud` preinstallato).

```bash
gcloud auth login
gcloud config set project IL_TUO_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Dalla cartella **`backend/`**:
```bash
cd backend

gcloud run deploy finance-tracker \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --min-instances 0 --max-instances 3 \
  --set-env-vars ENV=production,LOG_LEVEL=INFO,SUPABASE_URL=https://xxxx.supabase.co,SUPABASE_KEY=LA_SERVICE_ROLE_KEY,ALLOWED_ORIGINS=https://finance-tracker-six-neon.vercel.app
```

- `--source .` → Cloud Build rileva il **Dockerfile** in `backend/` (qui il build context è già corretto perché lanci dalla cartella giusta) e crea da solo il repo Artifact Registry `cloud-run-source-deploy`.
- `--allow-unauthenticated` → **fondamentale**, vedi sopra.
- La porta non si specifica: Cloud Run instrada sulla `8080` del container.

> **Virgole in `--set-env-vars`**: la virgola è il separatore. Se `ALLOWED_ORIGINS` avesse **più domini**, usa un delimitatore custom, es.
> `--set-env-vars "^@^ALLOWED_ORIGINS=https://a.com,https://b.com@ENV=production"`, oppure impostale dalla Console.

Anche il percorso CLI richiede i permessi IAM del punto 3.

---

## Verifica del backend

Quattro controlli che coprono deploy, config e CORS senza bisogno di aprire il frontend:

```bash
BASE=https://finance-tracker-955820740556.europe-west1.run.app

curl $BASE/health                  # → 200 {"status":"ok"}
curl -o /dev/null -w "%{http_code}\n" $BASE/docs          # → 404 (ENV=production applicato)
curl -o /dev/null -w "%{http_code}\n" $BASE/transactions  # → 401 (app viva, auth attiva)

# preflight CORS dall'origin Vercel → 200 + header access-control-allow-origin corretto
curl -i -X OPTIONS $BASE/transactions \
  -H "Origin: https://finance-tracker-six-neon.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization"
```

Interpretazione: `404` su `/docs` conferma `ENV=production`; `401` su `/transactions` conferma che l'app è viva e che l'auth funziona (un `500` indicherebbe env Supabase sbagliate); il preflight che torna `200` con l'origin giusto conferma `ALLOWED_ORIGINS`.

---

## Ricollegare il frontend (Vercel)

1. Vercel → progetto → **Settings → Environment Variables** → `VITE_API_URL` =
   ```
   https://finance-tracker-955820740556.europe-west1.run.app
   ```
   **Senza slash finale**: il frontend concatena `${API_URL}/transactions` ([`frontend/src/api/client.ts`](../frontend/src/api/client.ts)).
2. **Deployments** → ultimo deployment → **⋯ → Redeploy**, togliendo la spunta a *"Use existing Build Cache"*.

   Il redeploy **non è opzionale**: Vite *inlinea* le `VITE_*` nel bundle a build time. Cambiare la variabile senza ricostruire lascia il sito a chiamare il vecchio backend.
3. `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` restano invariate — Supabase non cambia.
4. Il redirect di Supabase per il reset password è lato frontend → non cambia nulla.

Per cambiare `ALLOWED_ORIGINS` dopo (es. nuovo dominio Vercel): Console → servizio → **Modifica e distribuisci nuova revisione** → Variabili, oppure
```bash
gcloud run services update finance-tracker --region europe-west1 \
  --update-env-vars ALLOWED_ORIGINS=https://tuo-dominio.vercel.app
```

---

## Smoke test

- [ ] Login funziona
- [ ] Le transazioni si caricano (Network → chiamate verso il dominio `run.app`, header `Authorization` presente)
- [ ] Importazione di un CSV va a buon fine
- [ ] Mappa si apre, "Arricchisci posizioni" risponde senza errori
- [ ] Refresh su `/budget` o `/transactions` non dà 404 (rewrite SPA lato Vercel)

---

## Troubleshooting

### Build fallita in pochi secondi senza log

**Sintomo:** la build fallisce in ~19 secondi, i 4 passaggi (Pull / Build / Push / Deploy) hanno tutti durata `—` cioè non sono mai partiti, e il pannello **Log di build** è vuoto con l'avviso:

> Il service account `955820740556-compute@developer.gserviceaccount.com` non dispone dell'autorizzazione per scrivere i log. Assicurati che al service account utilizzato per la build sia stata concessa l'autorizzazione `logging.logEntries.create` (inclusa nel ruolo "Logs Writer").

**Causa:** dal 2024 Google non assegna più automaticamente il ruolo `Editor` al service account di default di Compute Engine sui progetti nuovi. Ma Cloud Build, quando è Cloud Run a crearne il trigger, continua a usare proprio quello — che quindi nasce senza i permessi per scrivere log, pushare su Artifact Registry e deployare. **Non è un problema del codice.**

**Fix:** i ruoli IAM del [punto 3](#3-permessi-iam-del-service-account-di-build-️). Poi **"Riprova a eseguire la build"** dalla schermata Dettagli build.

La perfidia di questo errore è che il permesso mancante è proprio quello che servirebbe per *vedere* l'errore: finché non lo concedi, ogni diagnosi è a indovinare.

### `requirements.txt: not found` nei log di build

Build context sbagliato: il percorso Dockerfile deve essere `/backend/Dockerfile`, non `/Dockerfile`. Vedi [punto 2](#2-configura-con-developer-connect).

### Ogni chiamata risponde 403, login compreso

Il servizio è stato creato con "Richiedi autenticazione". Console → servizio → **Sicurezza** (o tab **Networking/Autorizzazioni**) → consenti l'accesso pubblico, oppure:
```bash
gcloud run services add-iam-policy-binding finance-tracker --region europe-west1 \
  --member="allUsers" --role="roles/run.invoker"
```

### Errori CORS nel browser

`ALLOWED_ORIGINS` non combacia esattamente con il dominio Vercel (attenzione allo slash finale e a `http` vs `https`). Verifica con il preflight della sezione [Verifica](#verifica-del-backend).

### Il container non parte / errori di memoria durante l'import

Alza la memoria a 1 GiB o 2 GiB: `pandas` + `openpyxl` su un file grosso superano facilmente i 512 MiB di default.

---

## Note operative

### Aggiornamenti futuri

Il deploy continuo è **già attivo**: ogni `git push` su `main` fa partire la build e rideploya da solo (trigger `cloudrun-finance-tracker-europe-west1-...`, visibile in Cloud Run → servizio → **Trigger**).

In alternativa, deploy manuale da `backend/`:
```bash
gcloud run deploy finance-tracker --source . --region europe-west1
```
(le env var già impostate vengono mantenute).

### Cold start

Con `min-instances: 0` il servizio **scala a zero**: la prima richiesta dopo un periodo di inattività paga l'avvio del container (qualche secondo, deve caricare pandas). Railway era invece always-on. Per eliminarlo:
```bash
gcloud run services update finance-tracker --region europe-west1 --min-instances=1
```
1 istanza sempre viva ha un piccolo costo mensile; con `--min-instances=0` resti nel gratuito ma accetti i cold start.

### Segreto più protetto (opzionale)

Invece di passare `SUPABASE_KEY` in chiaro come env var, usa **Secret Manager**:
```bash
echo -n "LA_SERVICE_ROLE_KEY" | gcloud secrets create supabase-key --data-file=-
gcloud run services update finance-tracker --region europe-west1 \
  --update-secrets SUPABASE_KEY=supabase-key:latest
```
Richiede di dare al service account del servizio il ruolo `roles/secretmanager.secretAccessor`.

### Costo

Free tier Cloud Run: 2M richieste/mese, 360k GB-s di memoria e 180k vCPU-s inclusi. Per uso personale con `min-instances=0` il costo è tipicamente **zero**. Con `min-instances=1` si paga l'istanza sempre attiva (poche unità di euro/mese). Il tetto `max-instances=3` è un paracadute contro sorprese in bolletta.

### Log

Console → Cloud Run → servizio → **Osservabilità → Log** (in tempo reale), oppure:
```bash
gcloud run services logs read finance-tracker --region europe-west1
```

---

## Variabili d'ambiente — riferimento

| Variabile | Descrizione |
|---|---|
| `SUPABASE_URL` | URL del progetto Supabase (`https://<project>.supabase.co`) |
| `SUPABASE_KEY` | **Service role key** — bypassa la RLS, non esporla mai al client |
| `ALLOWED_ORIGINS` | Dominio Vercel del frontend (CORS), senza slash finale |
| `ENV` | `production` in produzione (disattiva `/docs` e restringe il CORS) |
| `LOG_LEVEL` | `INFO` (o `DEBUG`/`WARNING`/`ERROR`) |
