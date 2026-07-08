-- ─────────────────────────────────────────────────────────────────────────────
-- Finance Tracker — Migration orig_amount (identità di import immutabile)
-- Esegui nel SQL Editor di Supabase (una volta sola).
--
-- Problema risolto: la deduplicazione confronta (data, descrizione, importo)
-- CORRENTE. Modificando a mano l'importo di una transazione importata, il
-- re-import dello stesso file non la riconosce più e reinserisce l'originale.
--
-- `orig_amount` congela l'importo al momento dell'inserimento (import o
-- creazione manuale) e non viene mai aggiornato: il deduplicatore confronta
-- il file con questo valore, così la riga modificata continua a
-- "rappresentare" quella originale del file.
--
-- Nota backfill: per le transazioni già modificate in passato l'importo
-- originale è perso — viene congelato quello attuale. Per quelle righe un
-- re-import può creare il duplicato un'ultima volta: eliminarlo a mano
-- (la soft-delete lo bloccherà per sempre da lì in poi).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS orig_amount NUMERIC;

UPDATE transactions
SET orig_amount = amount
WHERE orig_amount IS NULL;
