-- ─────────────────────────────────────────────────────────────────────────────
-- Finance Tracker — Migration RLS (vedi docs/assessment.md, punto S1)
-- Esegui nel SQL Editor di Supabase (una volta sola).
--
-- Abilita la Row Level Security su tutte le tabelle SENZA aggiungere policy:
-- - l'API REST di Supabase (PostgREST) con anon key / authenticated non può
--   più leggere né scrivere nulla (prima aveva accesso completo);
-- - il backend FastAPI non è toccato: usa la service role key, che ha
--   BYPASSRLS e ignora la RLS;
-- - il frontend non è toccato: usa Supabase solo per l'auth, mai per i dati.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_locations  ENABLE ROW LEVEL SECURITY;


-- ── Verifica ──────────────────────────────────────────────────────────────────
-- Tutte le righe devono avere rowsecurity = true:

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'transactions', 'categories', 'split_items', 'import_profiles',
    'settings', 'user_rules', 'audit_log', 'merchant_locations'
  )
ORDER BY tablename;
