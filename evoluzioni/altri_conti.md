# Evolutive — Multi-account

**Stato:** ipotesi progettuale, non implementata.
**Data:** luglio 2026.

---

## Scenario

Oggi l'app traccia un unico conto corrente. Questa analisi descrive come adattare l'architettura se in futuro si aprissero conti paralleli — dal caso minimo a quello complesso.

**Caso semplice**: un conto corrente + un conto risparmio (100 €/mese in automatico).

**Caso complesso**: cinque conti con scopi distinti:
1. **Conto corrente** — entrate (stipendio) e spese quotidiane
2. **Conto risparmio** — accumulo con versamenti mensili automatici
3. **Conto vincolato** — deposito a termine (es. 6/12 mesi), interessi fissi
4. **Conto investimenti** — ETF / azioni, valore di mercato variabile
5. **Conto abbonamenti** — conto separato per addebiti ricorrenti (Spotify, Netflix, assicurazioni)

---

## Concetti fondamentali (prima delle fasi)

### 1. Account

Un conto è un contenitore di liquidità o investimenti con un saldo proprio. Ha un tipo che ne determina il comportamento nella UI e nei calcoli.

### 2. Trasferimento

Il concetto più delicato. Quando sposto 100 € dal corrente al risparmio:
- Non è una **spesa** (i soldi sono ancora miei)
- Non è un **entrata** (non li ho guadagnati)
- Il patrimonio netto totale resta invariato; cambiano solo i saldi dei due conti

Il modello attuale non ha questo concetto: ogni riga `transactions` è o negativa (uscita) o positiva (entrata). I trasferimenti vanno gestiti come una **transazione singola con conto sorgente e conto destinazione** (`account_id` + `to_account_id`), con `source = 'trasferimento'` ed esclusa dai totali di spesa/entrata (vedi nota nel paragrafo *Modifica transactions*).

### 3. Patrimonio netto (Net Worth)

Con più conti il "saldo" diventa ambiguo. Si distinguono:
- **Saldo conto X** = saldo iniziale del conto + somma transazioni di quel conto
- **Patrimonio netto** = somma dei saldi di tutti i conti attivi (incluso il valore di mercato degli investimenti, se aggiornato)

Il patrimonio netto è la metrica principale della nuova Panoramica multi-account.

---

## Fase 1 — Caso minimo: secondo conto (risparmio)

Modifica minimale per supportare un conto corrente + un conto risparmio.

### Cosa cambia nel DB

#### Nuova tabella `accounts`

```sql
CREATE TABLE accounts (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT    NOT NULL,                             -- "Conto corrente", "Risparmio Fineco"
  type         TEXT    NOT NULL DEFAULT 'checking'
               CHECK (type IN ('checking', 'savings', 'investment', 'locked', 'other')),
  color        TEXT    NOT NULL DEFAULT '#6C9BCF',
  icon         TEXT    NOT NULL DEFAULT '🏦',
  institution  TEXT,                                         -- "Fineco", "ING", ecc. (opzionale)
  iban_last4   TEXT,                                         -- ultime 4 cifre IBAN (opzionale, per riconoscimento)
  saldo_iniziale NUMERIC NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

#### Modifica `transactions`

```sql
ALTER TABLE transactions
  ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;

-- Per i trasferimenti: FK al conto di destinazione (NULL per transazioni normali)
ALTER TABLE transactions
  ADD COLUMN to_account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;
```

Indici aggiuntivi: `idx_transactions_account` su `(account_id)`.

> **Modello trasferimenti — deciso: riga singola.** La prima stesura prevedeva sia `to_account_id` sia una coppia di righe collegate da `linked_transfer_id` — due modelli alternativi, non complementari. Si sceglie la **riga singola**: un trasferimento è UNA transazione con `account_id` (sorgente), `to_account_id` (destinazione) e `source='trasferimento'`. Vantaggi: niente coppia da tenere sincronizzata su update/delete, nessun `linked_transfer_id` senza FK. Il saldo del conto sorgente sottrae l'importo, quello del conto destinazione lo somma (logica nel calcolo saldo di `GET /accounts`, non nei dati). Se in futuro servisse la coppia (es. per import da CSV di entrambi i conti), `linked_transfer_id` andrebbe comunque reso self-FK verso `transactions(id)`.

#### Migrazione `settings`

La chiave `saldo_iniziale` nella tabella `settings` (oggi globale) diventa il saldo del "conto principale" e può essere migrata all'account corrente durante il deploy della Fase 1.

#### Profili import

```sql
ALTER TABLE import_profiles
  ADD COLUMN account_id BIGINT REFERENCES accounts(id) ON DELETE SET NULL;
```

Così ogni profilo "Fineco corrente" sa automaticamente su quale conto importare.

### Cosa cambia nel backend

- **`GET /accounts`** — lista conti con saldo calcolato (saldo_iniziale + somma transazioni dell'account)
- **`POST /accounts`** — crea conto
- **`PATCH /accounts/{id}`** — modifica nome/colore/icona/saldo_iniziale
- **`POST /transfers`** — crea un trasferimento: una transazione singola con `account_id` + `to_account_id`, `source='trasferimento'`, esclusa da spese/entrate
- Tutti gli endpoint esistenti (`/transactions`, `/summary`, `/timeline`) accettano `account_id` come filtro opzionale. Senza filtro: vista cross-account (comportamento attuale preservato per default).
- `GET /transactions/summary` e `/timeline`: escludono `source='trasferimento'` dal calcolo spese/entrate (contano solo il saldo).

### Cosa cambia nel frontend

**Minimo indispensabile per il caso semplice:**

- Nuova voce in **Impostazioni**: "I miei conti" — lista conti, add/edit, saldo iniziale per conto.
- Selettore conto nel drawer Importazione (obbligatorio quando si importa).
- **Panoramica** e **Transazioni**: filtro `account_id` opzionale → default = "Tutti i conti".
- Nuova voce "Tipo: Trasferimento" nel form "Nuova transazione": seleziona Da/A e importo, crea la transazione singola di trasferimento.
- In lista transazioni: i trasferimenti mostrano icona freccia ↔ e il nome del conto opposto, non categoria.

---

## Fase 2 — Caso completo: multi-account con patrimonio

Estende la Fase 1 con vista patrimonio e gestione dei tipi di conto speciali.

### Nuova pagina: Patrimonio

Sostituisce o affianca l'attuale Panoramica. Mostra:

```
┌─────────────────────────────────────────┐
│  PATRIMONIO NETTO                        │
│  € 24.350                               │
│                                         │
│  ■ Corrente        € 2.100   checking   │
│  ■ Risparmio       € 8.500   savings    │
│  ■ Vincolato       € 5.000   locked     │
│  ■ Investimenti   € 8.750   investment  │
│  ■ Abbonamenti     −€ 50 *  checking   │
└─────────────────────────────────────────┘
* saldo negativo in attesa del prossimo stipendio
```

Grafico a torta o barre orizzontali per composizione del patrimonio.
Grafico storico: andamento patrimonio netto nel tempo (aggiornato a ogni import/transazione).

### Conto abbonamenti

Non richiede logica speciale: è un conto `type='checking'` dedicato. Il valore aggiunto è:

- In Impostazioni → Conti: flag `auto_category` → le transazioni su questo conto vengono pre-categorizzate come "Abbonamenti" all'import.
- Budget: possibilità di vedere il budget "Abbonamenti" filtrato per questo conto.

```sql
ALTER TABLE accounts
  ADD COLUMN auto_category TEXT;  -- se valorizzato, pre-assegna categoria all'import
```

### Conto vincolato

Un deposito a termine ha un comportamento deterministico: deposito iniziale + interessi a scadenza.

```sql
ALTER TABLE accounts
  ADD COLUMN locked_maturity_date DATE,       -- data scadenza (solo type='locked')
  ADD COLUMN locked_interest_rate NUMERIC,    -- tasso annuo lordo (solo type='locked')
  ADD COLUMN locked_deposit_amount NUMERIC;   -- importo depositato (solo type='locked')
```

UI: nella card del conto vincolato, mostrare:
- Importo depositato
- Interessi maturati ad oggi (calcolati lato frontend: `deposito × tasso × giorni/365`)
- Importo atteso a scadenza
- Barra di avanzamento verso la scadenza

Le transazioni reali sul conto vincolato sono solo due: il trasferimento in entrata (deposito) e, alla scadenza, il ritorno capitale + interessi (trasferimento verso il corrente + eventuale tassa).

### Conto investimenti

Il conto investimenti è il più complesso perché il valore varia indipendentemente dai flussi di cassa.

**Flussi di cassa (transazioni normali):**
- Deposito iniziale → trasferimento dal corrente
- Acquisto ETF/azioni → uscita da questo conto (non è una spesa, è una conversione da liquidità a asset)
- Dividendi → entrata (è reddito reale)
- Rimborso/vendita → entrata (ritorno di capitale ± plusvalenza)
- Prelievo → trasferimento verso corrente

**Valore di mercato (non derivabile dalle transazioni):**

```sql
CREATE TABLE portfolio_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  account_id   BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  market_value  NUMERIC NOT NULL,   -- valore di mercato totale del portafoglio quel giorno
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, snapshot_date)
);
```

L'utente inserisce il valore di mercato manualmente (o futuro: integrazione API broker). Il patrimonio netto usa l'ultimo snapshot disponibile per il conto investimenti.

**Distinzione book value vs market value:**
- **Book value** = liquidità depositata − prelievi = calcolabile dalle transazioni
- **Market value** = valore effettivo del portafoglio = da `portfolio_snapshots`
- **Plusvalenza latente** = market value − book value (mostrata nella card del conto)

---

## Architettura frontend — vista d'insieme

```
App
 ├── Panoramica          ← aggiunta: selezione conto / tutti; KPI adattati
 ├── Transazioni         ← aggiunta: filtro per conto; trasferimenti con icona diversa
 ├── Budget              ← aggiunta: toggle "per conto" / "tutti"
 ├── Mappa               ← invariata (usa già account_id delle transazioni filtrate)
 ├── Importazione        ← aggiunta: selezione obbligatoria del conto destinazione
 └── Impostazioni
      ├── Profili import  ← aggiunta: conto predefinito per profilo
      ├── Conti           ← NUOVA SEZIONE
      │    ├── Lista conti con saldo e tipo
      │    ├── Aggiungi / modifica conto
      │    ├── Conto vincolato: maturity date, tasso
      │    └── Conto investimenti: log snapshot valore mercato
      └── Patrimonio      ← NUOVA SEZIONE (o integrata in Panoramica)
```

---

## Note di revisione (luglio 2026)

- **Grafico storico del patrimonio netto**: per i conti cassa è ricostruibile dalle transazioni, ma per il conto investimenti dipende dagli snapshot manuali → l'andamento sarà "a gradini" tra uno snapshot e l'altro. Accettabile, ma da mettere in conto nella resa del grafico (es. interpolazione a scalini, non lineare).
- **Migration `source`**: il valore `'trasferimento'` richiede di modificare il CHECK constraint su `transactions.source`. Il piano ricorrenze (`transazioni_ricorrenti.md`) tocca lo stesso constraint con `'ricorrente'`: se le ricorrenze vengono implementate prima (ordine consigliato), aggiungere entrambi i valori in un'unica migration.
- **Ricorrenze e conti**: le transazioni generate dalle ricorrenze dovranno ereditare un `account_id` — basterà un campo opzionale sulla tabella `recurring`, nessuna dipendenza bloccante.
- **Priorità**: non anticipare l'implementazione rispetto ai bisogni reali — partire con la Fase 1a solo quando il secondo conto esiste davvero.

---

## Decisioni aperte

| Questione | Opzione A (conservativa) | Opzione B (completa) |
|---|---|---|
| **Saldo corrente cross-account** | Solo top-level "patrimonio totale" | Grafico storico patrimonio aggregato |
| **Trasferimenti nell'import CSV** | Riconoscimento manuale (l'utente li marca) | Auto-riconoscimento per importo+data su conti diversi |
| **Investimenti: aggiornamento valore** | Solo inserimento manuale snapshot | Integrazione API broker (Degiro, Fineco) |
| **Account_id obbligatorio** | Nullable (account=NULL = "non assegnato") | Default all'account principale, obbligatorio nel drawer |
| **Budget multi-account** | Budget sempre cross-account | Budget per singolo conto (es. solo "Abbonamenti") |
| **Valuta** | Solo EUR (tutto mono-valuta) | Colonna `currency` su accounts (multi-valuta complesso) |

---

## Ordine di implementazione consigliato

1. **Fase 1a** — Tabella `accounts` + migration `account_id` su transactions (nullable). Seed: un account "Conto principale" che eredita il `saldo_iniziale` dalle settings. Nessun cambiamento UI visibile.

2. **Fase 1b** — UI Impostazioni → Conti. Import obbligatoriamente legato a un conto. Filtro per conto in Transazioni.

3. **Fase 1c** — Creazione trasferimenti (form da/a/importo → transazione singola con `to_account_id`). Esclusione trasferimenti da spese/entrate nel summary.

4. **Fase 2a** — Sezione Patrimonio / widget in Panoramica con saldi per conto.

5. **Fase 2b** — Conto vincolato (campi maturity + rate, calcolo interessi nella card).

6. **Fase 2c** — Conto investimenti (portfolio_snapshots, plusvalenza latente).

7. **Fase 2d** — Conto abbonamenti / `auto_category` (feature di convenience, basso impatto).
