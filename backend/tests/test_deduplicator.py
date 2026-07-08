"""Test unitari per la chiave di deduplicazione (funzione pura, nessun DB)."""

from services.deduplicator import _key


class TestKey:
    def test_riga_file_senza_orig_amount_usa_amount(self):
        row = {"date": "2026-07-01", "description": "Penny Market Monza", "amount": -45.5}
        assert _key(row) == ("2026-07-01", "penny market monza", -45.5)

    def test_riga_db_con_orig_amount_usa_orig(self):
        # transazione importata a -45.50 e poi modificata a mano a -30.00:
        # per la dedup deve valere ancora l'importo originale
        row = {
            "date": "2026-07-01",
            "description": "Penny Market Monza",
            "amount": -30.0,
            "orig_amount": -45.5,
        }
        assert _key(row) == ("2026-07-01", "penny market monza", -45.5)

    def test_orig_amount_null_fallback_su_amount(self):
        # righe antecedenti alla migration: orig_amount NULL nel DB
        row = {
            "date": "2026-07-01",
            "description": "Esselunga",
            "amount": -12.0,
            "orig_amount": None,
        }
        assert _key(row) == ("2026-07-01", "esselunga", -12.0)

    def test_match_tra_riga_file_e_riga_db_modificata(self):
        file_row = {"date": "2026-07-01", "description": "PENNY  MARKET Monza ", "amount": -45.5}
        db_row = {
            "date": "2026-07-01",
            "description": "Penny Market Monza",
            "amount": -30.0,
            "orig_amount": -45.5,
        }
        assert _key(file_row) == _key(db_row)
