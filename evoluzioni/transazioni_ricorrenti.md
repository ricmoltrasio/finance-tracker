# Evolutive — piano feature

Raccolta delle evoluzioni progettate ma non ancora implementate. Ogni voce è abbastanza dettagliata da poter essere ripresa e costruita in autonomia.

---

## 1. Ricorrenze (spese ricorrenti + ammortamento spese annuali)

**Stato:** progettata, non implementata.
**Data progettazione:** giugno 2026.

### Problema

Due esigenze distinte emerse dall'uso reale:

1. **Spese annuali da vedere spalmate** — es. Amazon Prime €72/anno, ma per ragionare sul budget la si vuole vedere come ~€6/mese (logica di *competenza*, non di cassa).
2. **Spese ricorrenti non presenti nell'import** — es. affitto pagato in contanti, abbonamenti pagati con soldi fuori conto. Oggi vanno inserite a mano ogni mese.

### Principio guida (vincolo non negoziabile)

> Il saldo e l'andamento (`timeline`) devono restare **cassa reale**: i soldi effettivamente usciti dal conto, quando sono usciti.

Conseguenze:
- **Mai** spalmare una spesa annuale creando 12 transazioni finte: falserebbe il saldo e, se la spesa arriva anche dall'import, la conterebbe due volte.
- **Mai** generare una transazione per soldi che sono *già* contati altrove (es. un affitto pagato con contanti prelevati dal conto: il prelievo è già un'uscita registrata → aggiungere "Affitto" conterebbe due volte).

### Decisioni prese

- **Esigenza 2 (ricorrenti non importate):** riguarda **soldi fuori conto** (mai passati dal conto corrente). Quindi vanno **generate come transazioni reali** in modo semi-automatico. Niente rischio di doppio conteggio perché questi soldi non compaiono da nessun'altra parte.
- **Esigenza 1 (ammortamento annuale):** approccio consigliato = **pannello dedicato nel Budget** (vista di sola analisi), che NON tocca le transazioni. Alternativa più complessa (integrazione nei totali per categoria con link transazione↔ricorrenza) rimandata, vedi sotto.

### Soluzione: un'unica entità "Ricorrenza"

Una tabella nuova descrive una spesa ricorrente. Due flag indipendenti abilitano le due capability:

- `genera = true` → ricorrenza fuori conto: l'app propone/crea la transazione reale a ogni scadenza (Esigenza 2).
- `ammortizza = true` → entra nel pannello "costi mensili di competenza" del Budget, normalizzata a importo/mese (Esigenza 1).

Una ricorrenza può avere uno, l'altro, o entrambi i flag.

#### Schema DB (nuova tabella)

```sql
CREATE TABLE IF NOT EXISTS recurring (
  id             BIGSERIAL PRIMARY KEY,
  description    TEXT    NOT NULL,
  category       TEXT    NOT NULL,
  amount         NUMERIC NOT NULL,            -- per singola occorrenza; negativo = uscita (coerente con transactions)
  frequency      TEXT    NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  day_of_month   INT     DEFAULT 1,           -- giorno di addebito
  month          INT,                         -- solo per 'yearly' (1-12)
  genera         BOOLEAN DEFAULT FALSE,       -- genera transazioni reali (fuori conto)
  ammortizza     BOOLEAN DEFAULT FALSE,       -- mostra nel pannello competenza del Budget
  last_generated DATE,                        -- ultima occorrenza già generata (solo se genera=true)
  active         BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

Nessuna foreign key verso `transactions`: le due capability non richiedono di collegare le transazioni generate (basta `last_generated` per non duplicare).

#### Capability A — Generazione assistita (Esigenza 2)

Flusso semi-automatico, niente inserimento manuale ripetuto:

1. Endpoint `GET /recurring/pending` calcola le occorrenze **dovute e non ancora generate** per ogni ricorrenza con `genera=true`: tutte le scadenze tra `last_generated` (o la prima scadenza) e oggi.
2. La UI mostra una lista "Da registrare" (es. *"Affitto — Giugno — €500 [Conferma] [Salta]"*).
3. Conferma → `POST /recurring/{id}/generate` crea la **transazione reale** (`source = 'ricorrente'`) e aggiorna `last_generated`.
   - Variante possibile: pulsante "Conferma tutte".
   - Variante possibile: generazione automatica al login (più comoda ma meno controllo) — da valutare; default consigliato = conferma manuale.

Il saldo resta corretto perché sono soldi che escono davvero e non comparivano altrove.

#### Capability B — Pannello ammortamento nel Budget (Esigenza 1)

Approccio consigliato (scelto come default): **vista di sola analisi**.

- Nuova sezione nella pagina Budget: **"Costi ricorrenti (competenza mensile)"**.
- Elenca tutte le ricorrenze attive con `ammortizza=true`, ciascuna normalizzata a mensile:
  - `frequency = monthly` → `amount`
  - `frequency = yearly` → `amount / 12`
- Mostra il totale = "costo fisso mensile".
- **Non tocca le transazioni né il saldo**: legge solo la tabella `recurring`. Zero rischio di doppio conteggio perché è un numero esplicitamente etichettato come "competenza", separato dalle spese reali del mese.

Esempio:
```
BUDGET — Costi ricorrenti (competenza)
  Amazon Prime     6,00/mese
  Netflix         12,99/mese
  Affitto        500,00/mese
  ───────────────────────────
  Totale         518,99/mese
```

**Alternativa rimandata** (più "magica", più complessa): integrare l'ammortamento nei totali reali per categoria, sostituendo l'addebito annuale con 1/12 in ogni mese. Richiede di collegare ogni transazione alla ricorrenza (per escludere l'addebito reale ed evitare il doppio conteggio) → foreign key + logica di riconciliazione nel `summary`. Da considerare solo se il pannello dedicato non basta.

### Componenti da realizzare

**Backend**
- `docs/migration_*.sql` — creazione tabella `recurring`.
- `routers/recurring.py` — CRUD (`GET/POST/PUT/DELETE /recurring`) + `GET /recurring/pending` + `POST /recurring/{id}/generate`. Registrare in `main.py`.
- Modelli Pydantic con validazioni (importo ≠ 0, frequency valida, month 1-12 se yearly).
- Aggiungere `'ricorrente'` ai valori ammessi di `transactions.source` (CHECK constraint) — oppure riusare `'manuale'` per evitare la migration sul constraint. *Decisione da prendere.*

**Frontend**
- `api/recurring.ts` + `hooks/useRecurring.ts`.
- Gestione ricorrenze: sezione in **Impostazioni** (accanto alle categorie) o pagina dedicata — form con descrizione, categoria, importo, frequenza, giorno/mese, flag genera/ammortizza.
- **Budget**: pannello "Costi ricorrenti (competenza)" + box "Da registrare" con conferma.

### Fasi suggerite

1. **Fase 1** — tabella + CRUD + UI di gestione (creare/modificare ricorrenze). Valore: censimento centralizzato.
2. **Fase 2** — generazione assistita (`pending` + conferma). Risolve l'Esigenza 2 ("non inserirle a mano").
3. **Fase 3** — pannello ammortamento nel Budget. Risolve l'Esigenza 1 (spalmatura annuale).

### Decisioni ancora aperte

- `source` delle transazioni generate: nuovo valore `'ricorrente'` (più pulito per filtrare) vs riuso `'manuale'` (nessuna migration sul constraint).
- Generazione: conferma manuale (default consigliato) vs automatica.
- Dove vive la gestione ricorrenze: sezione in Impostazioni vs pagina dedicata in navigazione.
- Frequenze supportate: per ora `monthly`/`yearly`; eventuale `quarterly`/`weekly` in futuro.
