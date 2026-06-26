-- Finance Tracker — Soft delete
-- Esegui nel SQL Editor di Supabase (una volta sola).

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
  ON transactions(deleted_at)
  WHERE deleted_at IS NOT NULL;
