-- ─────────────────────────────────────────────────────────────────────────────
-- Finance Tracker v2 — Migration iniziale
-- Esegui nel SQL Editor di Supabase (una volta sola).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. Estendi tabella transactions ──────────────────────────────────────────

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS tags     TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS note     TEXT    DEFAULT '';

-- Assicura che source abbia il constraint corretto
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'source'
  ) THEN
    ALTER TABLE transactions
      ADD COLUMN source TEXT DEFAULT 'manuale'
        CHECK (source IN ('import', 'manuale'));
  END IF;
END $$;


-- ── 2. Indici per performance ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transactions_date
  ON transactions(date);

CREATE INDEX IF NOT EXISTS idx_transactions_category
  ON transactions(category);

CREATE INDEX IF NOT EXISTS idx_transactions_date_amount
  ON transactions(date, amount);


-- ── 3. Tabella categories ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT    NOT NULL UNIQUE,
  keywords   TEXT[]  DEFAULT '{}',
  color      TEXT    DEFAULT '#6C9BCF',
  icon       TEXT    DEFAULT '🏷️',
  budget     NUMERIC,
  is_income  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ── 4. Tabella import_profiles ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS import_profiles (
  id            BIGSERIAL PRIMARY KEY,
  bank_name     TEXT NOT NULL,
  col_date      TEXT NOT NULL,
  col_desc      TEXT NOT NULL,
  amount_format TEXT NOT NULL CHECK (amount_format IN ('single', 'dare_avere')),
  col_amount    TEXT,
  col_dare      TEXT,
  col_avere     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_profiles_bank
  ON import_profiles(bank_name);


-- ── 5. Tabella settings ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY
               CHECK (key IN ('saldo_iniziale', 'valuta', 'default_import_profile')),
  value      TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'text'
               CHECK (value_type IN ('text', 'numeric', 'integer'))
);

INSERT INTO settings (key, value, value_type) VALUES
  ('saldo_iniziale',          '0',   'numeric'),
  ('valuta',                  'EUR', 'text'),
  ('default_import_profile',  '0',   'integer')
ON CONFLICT (key) DO NOTHING;


-- ── 6. Tabella split_items ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS split_items (
  id             BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE CASCADE,
  category       TEXT    NOT NULL,
  amount         NUMERIC NOT NULL,
  note           TEXT    DEFAULT ''
);


-- ── 7. Tabella user_rules ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_rules (
  id         BIGSERIAL PRIMARY KEY,
  pattern    TEXT        NOT NULL UNIQUE,
  category   TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_rules_pattern ON user_rules(pattern);


-- ── 8. Tabella audit_log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  action     TEXT        NOT NULL,
  user_email TEXT,
  details    JSONB,
  ip         TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);


-- ── 8. Seed categorie (fresh — dati ricaricati da zero) ───────────────────────
-- Le keyword sono lasciate vuote intenzionalmente: il backend le popola
-- automaticamente al primo GET /categories tramite lazy-seed (HARDCODED_KEYWORDS
-- in services/categorizer.py), garantendo che siano sempre allineate al codice.

TRUNCATE categories RESTART IDENTITY;

INSERT INTO categories (name, keywords, color, icon, is_income) VALUES
  ('Cibo',            ARRAY[]::TEXT[], '#6CBF8E', '🍽️', FALSE),
  ('Auto',            ARRAY[]::TEXT[], '#6C9BCF', '🚗', FALSE),
  ('Salute',          ARRAY[]::TEXT[], '#A78BFA', '💊', FALSE),
  ('Intrattenimento', ARRAY[]::TEXT[], '#EF7B7B', '🎮', FALSE),
  ('Abbonamenti',     ARRAY[]::TEXT[], '#EC4899', '📱', FALSE),
  ('Shopping',        ARRAY[]::TEXT[], '#F59E0B', '🛍️', FALSE),
  ('Teatro e cinema', ARRAY[]::TEXT[], '#8B5CF6', '🎭', FALSE),
  ('Spostamenti',     ARRAY[]::TEXT[], '#14B8A6', '🚇', FALSE),
  ('Viaggi',          ARRAY[]::TEXT[], '#F97316', '✈️', FALSE),
  ('Altro',           ARRAY[]::TEXT[], '#64748B', '🏷️', FALSE),
  ('Stipendio',       ARRAY[]::TEXT[], '#10B981', '💰', TRUE),
  ('Contanti',        ARRAY[]::TEXT[], '#06B6D4', '💵', TRUE),
  ('Rimborsi',        ARRAY[]::TEXT[], '#84CC16', '📥', TRUE);
