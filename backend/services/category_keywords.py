"""Caricamento centralizzato delle keyword di categorizzazione.

Il DB è la fonte di verità; le regole hardcoded in `categorizer.py` servono solo
come seed/fallback. Questo modulo elimina la logica duplicata che prima viveva
sia in routers/categories.py che in routers/import_router.py.
"""

from __future__ import annotations

from services.categorizer import EXPENSE_RULES, INCOME_RULES

HARDCODED_KEYWORDS: dict[str, list[str]] = {
    name: kws for name, kws in EXPENSE_RULES + INCOME_RULES
}


def load_db_categories(client) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    """Restituisce ({uscite}, {entrate}) come {nome_categoria: [keywords]}.

    Usa le keyword del DB; se una categoria non ne ha, ricade su quelle
    hardcoded (stesso comportamento del lazy-seed di GET /categories).
    """
    cats = (
        client.table("categories")
        .select("name,keywords,is_income")
        .execute()
        .data
    )
    expenses: dict[str, list[str]] = {}
    incomes: dict[str, list[str]] = {}
    for c in cats:
        kws = c.get("keywords") or HARDCODED_KEYWORDS.get(c["name"], [])
        (incomes if c["is_income"] else expenses)[c["name"]] = kws
    return expenses, incomes


def load_user_rules(client) -> list[dict]:
    """Regole utente (pattern -> categoria) usate con priorità dal categorizer."""
    return client.table("user_rules").select("pattern,category").execute().data
