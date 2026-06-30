-- Finance Tracker — reset completo delle posizioni geolocalizzate
-- Esegui nel SQL Editor di Supabase, una volta sola.
--
-- Azzera sia merchant_locations (manual + auto) sia gli override per-transazione
-- (loc_city/loc_lat/loc_lng), così il prossimo "Arricchisci posizioni" ricalcola
-- tutto da zero con la logica corretta del geocoder (es. rimozione sigla
-- provincia: "Saronno VA" non viene più confuso con Varese).
--
-- ATTENZIONE: cancella anche eventuali correzioni manuali di posizione fatte
-- a mano dal drawer delle transazioni.

DELETE FROM merchant_locations;

UPDATE transactions
SET loc_city = NULL, loc_lat = NULL, loc_lng = NULL
WHERE loc_city IS NOT NULL OR loc_lat IS NOT NULL OR loc_lng IS NOT NULL;
