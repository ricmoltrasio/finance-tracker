"""Test unitari per services/categorizer.py (funzione pura, nessun DB)."""

from services.categorizer import STIPENDIO_THRESHOLD, categorize


class TestStipendio:
    def test_importo_sopra_soglia_e_stipendio(self):
        assert categorize("BONIFICO QUALSIASI", STIPENDIO_THRESHOLD + 1) == "Stipendio"

    def test_importo_sotto_soglia_non_e_stipendio(self):
        assert categorize("BONIFICO QUALSIASI", STIPENDIO_THRESHOLD - 1) != "Stipendio"


class TestUserRules:
    def test_user_rule_ha_priorita_sulle_keyword(self):
        rules = [{"pattern": "esselunga", "category": "Shopping"}]
        assert categorize("ESSELUNGA MILANO", -30.0, user_rules=rules) == "Shopping"

    def test_user_rule_match_parziale_case_insensitive(self):
        rules = [{"pattern": "netflix", "category": "Intrattenimento"}]
        assert categorize("Pagamento NETFLIX.COM", -12.99, user_rules=rules) == "Intrattenimento"

    def test_user_rule_ha_priorita_sulla_soglia_stipendio(self):
        # Un'entrata sopra soglia corretta a mano deve restare nella sua categoria
        rules = [{"pattern": "rimborso 730", "category": "Rimborsi"}]
        assert categorize("RIMBORSO 730 AGENZIA ENTRATE", 700.0, user_rules=rules) == "Rimborsi"


class TestExpenseKeywords:
    def test_supermercato_in_cibo(self):
        assert categorize("ESSELUNGA VIA MONVISO", -45.50) == "Cibo"

    def test_benzina_in_auto(self):
        assert categorize("TAMOIL STAZIONE 123", -60.0) == "Auto"

    def test_descrizione_sconosciuta_in_altro(self):
        assert categorize("XYZWQK SCONOSCIUTO", -10.0) == "Altro"

    def test_openai_in_abbonamenti(self):
        # Regressione: la keyword "openai" era persa per una virgola mancante
        assert categorize("OPENAI CHATGPT SUBSCRIPTION", -20.0) == "Abbonamenti"


class TestIncome:
    def test_prelievo_in_contanti(self):
        assert categorize("PRELIEVO BANCOMAT", 100.0) == "Contanti"

    def test_rimborso_in_rimborsi(self):
        assert categorize("RIMBORSO SPESE", 50.0) == "Rimborsi"

    def test_entrata_sconosciuta_in_altro(self):
        assert categorize("ENTRATA GENERICA", 50.0) == "Altro"


class TestDbCategories:
    def test_keyword_db_sostituiscono_hardcoded(self):
        db = {"Cibo": ["pizzeriadaluigi"]}
        # la keyword DB vince
        assert categorize("PIZZERIADALUIGI SRL", -25.0, db_categories=db) == "Cibo"
        # la keyword hardcoded di Cibo non è più attiva per quella categoria
        assert categorize("ESSELUNGA", -25.0, db_categories=db) == "Altro"

    def test_fallback_hardcoded_se_categoria_assente_dal_db(self):
        db = {"Auto": ["benzinaio-x"]}
        # Cibo non è nel dict → usa le keyword hardcoded
        assert categorize("ESSELUNGA", -25.0, db_categories=db) == "Cibo"

    def test_categoria_nuova_solo_db_viene_matchata(self):
        # Una categoria creata dall'utente (assente dalle regole hardcoded)
        # deve comunque essere considerata
        db = {"Animali": ["veterinario", "toelettatura"]}
        assert categorize("VETERINARIO ROSSI", -80.0, db_categories=db) == "Animali"

    def test_keyword_db_entrate_sostituiscono_hardcoded(self):
        db_income = {"Rimborsi": ["cashback"]}
        # la keyword DB vince per le entrate
        assert categorize("CASHBACK STATO", 50.0, db_income_categories=db_income) == "Rimborsi"
        # la keyword hardcoded di Rimborsi non è più attiva per quella categoria
        assert categorize("RIMBORSO SPESE", 50.0, db_income_categories=db_income) == "Altro"
