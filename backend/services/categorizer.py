from __future__ import annotations

# Keyword lists preserve existing app keywords + additions from indicazioni.md.
# Order matters: first match wins. More specific rules go higher in the list.

EXPENSE_RULES: list[tuple[str, list[str]]] = [
    (
        "Cibo",
        [
            "esselunga", "conad", "lidl", "penny", "md ",
            "bar ", "ristorante", "pizzeria", "mcdonald", "caffe",
            "deliveroo", "just eat", "glovo",
        ],
    ),
    (
        "Auto",
        [
            "benzina", "tamoil", "eni ", "q8", "ip ",
            "meccanico", "autofficina", "gomme", "gommista",
            "telepass", "autogrill",
        ],
    ),
    (
        "Salute",
        [
            "farmacia", "medico", "dentista", "studio pizzi",
            "ottico", "parafarmacia", "creme", "dermatologo",
        ],
    ),
    (
        "Intrattenimento",
        [
            "cinema", "concerto", "videogioco", "steam",
            "playstation", "ticketmaster", "eventbrite", "ticketone",
        ],
    ),
    (
        "Abbonamenti",
        [
            "netflix", "spotify", "amazon prime", "google one",
            "claude.ai", "apple", "disney", "adobe",
        ],
    ),
    (
        "Shopping",
        [
            "amazon", "zara", "h&m", "hm it", "zalando",
            "ikea", "decathlon", "vestiti",
        ],
    ),
    (
        "Teatro e cinema",
        [
            "teatro",
        ],
    ),
    (
        "Spostamenti",
        [
            "trenitalia", "italo", "atm ", "uber", "flixbus",
            "parcheggio", "autostrada", "taxi", "ncc",
        ],
    ),
    (
        "Viaggi",
        [
            "hotel", "booking", "airbnb", "ryanair", "easyjet",
            "voli", "vacanza",
        ],
    ),
]

INCOME_RULES: list[tuple[str, list[str]]] = [
    ("Rimborsi", ["rimborso", "accredito"]),
    ("Contanti", ["contanti", "prelievo"]),
]

STIPENDIO_THRESHOLD = 600.0


def categorize(description: str, amount: float = 0.0) -> str:
    """Return the best matching category for a transaction.

    Stipendio is detected by amount alone (> 600 € positive).
    """
    if amount > STIPENDIO_THRESHOLD:
        return "Stipendio"

    desc_lower = description.lower()

    if amount > 0:
        for category, keywords in INCOME_RULES:
            for kw in keywords:
                if kw in desc_lower:
                    return category
        return "Altro"

    for category, keywords in EXPENSE_RULES:
        for kw in keywords:
            if kw in desc_lower:
                return category

    return "Altro"
