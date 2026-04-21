# 💶 Finance Tracker

Tracker spese personali costruito con **Streamlit** + **SQLite**.  
Importa CSV/Excel dalla banca, aggiungi spese in contanti, visualizza dashboard mensile.

---

## 🚀 Setup locale (5 minuti)

### 1. Prerequisiti
- Python 3.10+ → https://www.python.org/downloads/
- (Opzionale) Git → https://git-scm.com/

### 2. Installa le dipendenze

```bash
cd finance_tracker
pip install -r requirements.txt
```

### 3. Avvia l'app

```bash
streamlit run app.py
```

Si apre automaticamente su `http://localhost:8501` 🎉

---

## ☁️ Deploy su Streamlit Community Cloud (gratis)

1. Crea un repo su **GitHub** e carica questa cartella
2. Vai su https://share.streamlit.io → "New app"
3. Seleziona il repo e come file principale `app.py`
4. Click **Deploy** — l'app è online in ~2 minuti

> ⚠️ **Nota:** Su Streamlit Cloud il database SQLite si azzera ad ogni redeployment.  
> Per persistere i dati in cloud, in futuro puoi migrare a **Supabase** (free tier).  
> Per uso personale locale, il file `data/finance.db` persiste tranquillamente sul tuo PC.

---

## 📁 Struttura

```
finance_tracker/
├── app.py                  # entry point
├── requirements.txt
├── data/
│   └── finance.db          # database SQLite (creato automaticamente)
├── pages/
│   ├── dashboard.py        # grafici e KPI mensili
│   ├── importa.py          # upload CSV/Excel con mapping colonne
│   ├── aggiungi.py         # form spese manuali (contanti)
│   └── transazioni.py      # lista completa con filtri
└── utils/
    ├── db.py               # CRUD SQLite
    ├── categories.py       # regole auto-categorizzazione
    └── importer.py         # parsing CSV/Excel
```

---

## 🏦 Formato file banca

Il tool supporta qualsiasi CSV o Excel — ti chiede di mappare le colonne
(data, descrizione, importo) al primo import.  
Gestisce separatori `;` e `,`, formati numerici europei (`1.234,56`).

---

## 🗺️ Roadmap

- [x] Import CSV/Excel con mapping colonne
- [x] Inserimento manuale spese contanti
- [x] Auto-categorizzazione per keyword
- [x] Dashboard con torta + trend + KPI
- [x] Anti-duplicati all'importazione
- [ ] Budget mensile per categoria con alert
- [ ] Modifica categoria singola transazione
- [ ] Export CSV filtrato
- [ ] Confronto mese su mese
- [ ] Migrazione a Supabase per persistenza cloud
