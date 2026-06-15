# Finance Tracker

Applicazione personale per il tracciamento delle finanze: import estratti conto, categorizzazione automatica, budget mensili e analisi dell'andamento del saldo.

**Stack**: React 18 + TypeScript + Vite (frontend) · FastAPI + Supabase (backend).

## Documentazione

- [docs/README.md](docs/README.md) — funzionalità, processi chiave, riepilogo API e avvio in locale
- [docs/database_schema.md](docs/database_schema.md) — schema del database
- [docs/migration_v2.sql](docs/migration_v2.sql) — script SQL di setup (da eseguire una volta su Supabase)
- [aggiornamento.md](aggiornamento.md) — refactoring effettuati e migliorie future

## Struttura

| Cartella | Contenuto |
|---|---|
| `frontend/` | SPA React |
| `backend/` | API FastAPI (deploy su Fly.io) |
| `docs/` | documentazione e migration |
| `mocks/` | prototipi di design (archivio, non parte dell'app) |
| `finance-tracker/old-version/` | versione precedente (archivio) |

## Quick start

```bash
# Backend (richiede .env — vedi backend/.env.example)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# Frontend (richiede .env — vedi frontend/.env.example)
cd frontend && npm install && npm run dev

# Test backend
cd backend && python -m pytest tests/
```
