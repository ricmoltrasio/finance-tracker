from __future__ import annotations

# Order matters: first match wins. More specific rules go higher.

EXPENSE_RULES: list[tuple[str, list[str]]] = [
    (
        "Cibo",
        [
            # supermercati
            "esselunga", "conad", "lidl", "aldi", "carrefour", "coop ", "pam ",
            "eurospin", "penny", "penny market", "supermercato", "iperal", "bennet",
            "simply", "sigma", "naturasi", "md ", "md\t", "despar", "interspar",
            "famila", "il gigante", "gros ",
            # prodotti freschi / negozi alimentari
            "frutta", "verdura", "macelleria", "pescheria", "panetteria", "forno",
            "panificio", "gastronomia", "alimentari",
            # ristoranti & bar
            "bar ", "bar\t", "caffe", "cafe", "caffè", "coffee", "bistrot",
            "ristorante", "pizzeria", "trattoria", "osteria", "taverna", "braceria",
            "spaghetteria", "mcdonald", "burger king", "starbucks",
            "sushi", "kebab", "ramen", "indiano", "haveli",
            "gelateria", "pasticceria", "pub", "birreria",
            "donechiara", "iramen", "lino'", "novecento", "gin thonic", "bray hill",
            "mcdonald", "mc donald", "mcdonald's", "mcdonalds", "mcd ", "mc d",
            # delivery
            "deliveroo", "just eat", "glovo", "ubereats",
        ],
    ),
    (
        "Auto",
        [
            "benzina", "carburante", "tamoil", "eni ", "eni.", "eni*", "q8",
            "ip ", "shell", "agip",
            "meccanico", "autofficina", "officina", "gomme", "gommista",
            "revisione", "bollo", "rc auto",
            "telepass", "autogrill", "aspit", "autostrada",
        ],
    ),
    (
        "Salute",
        [
            # medico / farmacia
            "farmacia", "farmaco", "parafarmacia", "medico", "dottore", "visita",
            "laboratorio", "analisi", "dentista", "oculista", "fisioterapia",
            "ospedale", "clinica", "guardia medica", "sanitaria",
            "studio pizzi", "studio medico", "studio dentistico", "stp ",
            "ottico", "dermatologo", "creme",
            # benessere & cura persona
            "palestra", "gym", "fitness", "piscina", "tennis", "yoga",
            "pilates", "crossfit",
            "parrucchiere", "barbiere", "estetista", "nail ", "spa",
            "massaggio", "centro estetico",
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
        "Teatro e cinema",
        [
            "teatro",
        ],
    ),
    (
        "Abbonamenti",
        [
            "netflix", "spotify", "dazn", "now tv", "paramount", "mubi",
            "amazon prime", "prime video", "disney",
            "google*google one", "google*google play", "google one", "google play",
            "icloud", "dropbox",
            "claude.ai", "claude",  "openai", "chatgpt", "adobe", "microsoft",
            "antivirus", "vpn", "abbonamento",
            "apple",
        ],
    ),
    (
        "Shopping",
        [
            "amazon", "amzn", "zalando", "zara", "h&m", "hm it",
            "pull&bear", "pull & bear", "primark", "bershka", "shein", "asos",
            "intimissimi", "calzedonia", "oysho", "mango", "uniqlo", "tezenis",
            "camicissima", "jack & jones", "jack&jones", "vero moda", "only ",
            "name it", "selected",
            "ikea", "leroy merlin", "bricoman", "brico",
            "decathlon",
            "mediaworld", "unieuro", "euronics", "trony",
            "coin ", "rinascente",
            "libreria", "feltrinelli", "mondadori",
            "vestiti",
        ],
    ),
    (
        "Spostamenti",
        [
            "trenitalia", "trenord", "italo", "ntv", "atm ",
            "uber", "bolt", "taxi", "ncc",
            "flixbus", "wizz", "ita airways",
            "parcheggio", "autostrada",
        ],
    ),
    (
        "Viaggi",
        [
            "hotel", "booking", "airbnb", "hostel", "b&b", "agriturismo",
            "camping", "villaggio", "resort", "expedia", "lastminute",
            "ryanair", "easyjet",
            "voli", "vacanza",
        ],
    ),
]

INCOME_RULES: list[tuple[str, list[str]]] = [
    ("Contanti", ["contanti", "prelievo", "bancomat"]),
    ("Rimborsi", ["rimborso", "accredito"]),
]

STIPENDIO_THRESHOLD = 600.0


def categorize(
    description: str,
    amount: float = 0.0,
    user_rules: list[dict] | None = None,
    db_categories: dict[str, list[str]] | None = None,
) -> str:
    """
    db_categories: {category_name: [keywords]} from the DB categories table.
    When provided, DB keywords replace hardcoded ones for that category.
    Falls back to EXPENSE_RULES for any category not in db_categories.
    """
    if amount > STIPENDIO_THRESHOLD:
        return "Stipendio"

    desc_lower = description.lower().strip()

    if user_rules:
        for rule in user_rules:
            if rule["pattern"] in desc_lower:
                return rule["category"]

    expense_rules = [
        (name, (db_categories or {}).get(name) or kws)
        for name, kws in EXPENSE_RULES
    ]

    if amount > 0:
        for category, keywords in INCOME_RULES:
            for kw in keywords:
                if kw in desc_lower:
                    return category
        return "Altro"

    for category, keywords in expense_rules:
        for kw in keywords:
            if kw in desc_lower:
                return category

    return "Altro"
