"""Test unitari per services/parser.py (parsing date/importi e mappatura righe)."""

from services.parser import map_rows, _parse_amount, _parse_date


class TestParseAmount:
    def test_formato_italiano(self):
        assert _parse_amount("1.234,56") == 1234.56

    def test_formato_anglosassone(self):
        assert _parse_amount("1,234.56") == 1234.56

    def test_negativo_con_segno(self):
        assert _parse_amount("-45,50") == -45.50

    def test_negativo_tra_parentesi(self):
        assert _parse_amount("(45.50)") == -45.50

    def test_simbolo_valuta_rimosso(self):
        assert _parse_amount("€ 12,00") == 12.0

    def test_vuoto_e_none(self):
        assert _parse_amount("") is None
        assert _parse_amount(None) is None
        assert _parse_amount("-") is None
        assert _parse_amount("nan") is None


class TestParseDate:
    def test_formato_italiano(self):
        assert _parse_date("31/12/2025") == "2025-12-31"

    def test_formato_iso(self):
        assert _parse_date("2025-12-31") == "2025-12-31"

    def test_con_orario(self):
        assert _parse_date("2025-12-31T10:30:00") == "2025-12-31"

    def test_invalida(self):
        assert _parse_date("non-una-data") is None
        assert _parse_date("") is None


class TestMapRows:
    def test_formato_single(self):
        rows = [{"Data": "01/06/2026", "Desc": "ESSELUNGA", "Importo": "-45,50"}]
        out = map_rows(rows, "Data", "Desc", "single", col_amount="Importo")
        assert out == [{"date": "2026-06-01", "description": "ESSELUNGA", "amount": -45.50}]

    def test_formato_dare_avere(self):
        rows = [
            {"Data": "01/06/2026", "Desc": "SPESA", "Dare": "30,00", "Avere": ""},
            {"Data": "02/06/2026", "Desc": "ACCREDITO", "Dare": "", "Avere": "100,00"},
        ]
        out = map_rows(rows, "Data", "Desc", "dare_avere", col_dare="Dare", col_avere="Avere")
        assert out[0]["amount"] == -30.0  # dare = uscita, sempre negativo
        assert out[1]["amount"] == 100.0  # avere = entrata, sempre positivo

    def test_righe_invalide_scartate(self):
        rows = [
            {"Data": "data-rotta", "Desc": "X", "Importo": "10"},
            {"Data": "01/06/2026", "Desc": "", "Importo": "10"},
            {"Data": "01/06/2026", "Desc": "OK", "Importo": "0"},
            {"Data": "01/06/2026", "Desc": "VALIDA", "Importo": "5,00"},
        ]
        out = map_rows(rows, "Data", "Desc", "single", col_amount="Importo")
        assert len(out) == 1
        assert out[0]["description"] == "VALIDA"
