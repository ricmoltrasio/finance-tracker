-- Finance Tracker — merchant_locations
-- Esegui nel SQL Editor di Supabase (una volta sola).

CREATE TABLE IF NOT EXISTS merchant_locations (
  id          BIGSERIAL PRIMARY KEY,
  description TEXT    NOT NULL UNIQUE,  -- normalizzata: strip + lower + collapse spaces
  city        TEXT,
  country     TEXT    DEFAULT 'IT',
  lat         NUMERIC,
  lng         NUMERIC,
  source      TEXT    DEFAULT 'auto'
                CHECK (source IN ('auto', 'manual')),
  resolved_at TIMESTAMPTZ,              -- quando aggiornato a livello POI via Overpass
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_locations_description
  ON merchant_locations(description);
