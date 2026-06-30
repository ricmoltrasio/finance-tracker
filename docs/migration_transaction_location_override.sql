-- Finance Tracker — override posizione per singola transazione
-- Esegui nel SQL Editor di Supabase (una volta sola).
--
-- loc_city/loc_lat/loc_lng hanno priorità sul join con merchant_locations
-- quando valorizzati: permettono di correggere/impostare la posizione di
-- una transazione (o di un gruppo) senza toccare il merchant_locations
-- condiviso da tutte le transazioni con la stessa descrizione.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS loc_city TEXT,
  ADD COLUMN IF NOT EXISTS loc_lat  NUMERIC,
  ADD COLUMN IF NOT EXISTS loc_lng  NUMERIC;
