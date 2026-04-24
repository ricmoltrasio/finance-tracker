RULES = [
    ("Spesa alimentare", [
        "esselunga", "conad", "lidl", "aldi", "carrefour", "coop", "pam", "eurospin",
        "penny", "penny market", "supermercato", "iperal", "bennet", "simply", "sigma",
        "naturasi", "md ", "md\t", "frutta", "verdura", "macelleria", "pescheria",
        "panetteria", "forno", "panificio", "gastronomia", "alimentari", "despar",
        "interspar", "famila", "gros", "il gigante",
    ]),
    ("Ristoranti & Bar", [
        "mcdonald", "burger king", "starbucks", "ristorante", "trattoria", "pizzeria",
        "osteria", "sushi", "kebab", "gelateria", "pasticceria", "braceria",
        "bar ", "bar\t", "caffe", "cafe", "caffè", "coffee", "bistrot", "taverna",
        "pub", "birreria", "just eat", "deliveroo", "glovo", "ubereats",
        "donechiara", "iramen", "ramen", "gin thonic", "bray hill",
        "spaghetteria", "indiano", "haveli", "lino'", "novecento",
        "ristorante", "pizzeria", "braceria", "osteria", "trattoria",
    ]),
    ("Trasporti", [
        "atm", "trenord", "trenitalia", "italo", "ntv", "flixbus",
        "ryanair", "easyjet", "wizz", "ita airways",
        "uber", "bolt", "taxi", "ncc",
        "autostrada", "telepass", "parking", "parcheggio", "autogrill",
        "benzina", "carburante", "eni ", "eni.", "eni*", "q8", "tamoil", "ip ", "shell", "agip",
        "officina", "revisione", "bollo", "rc auto",
    ]),
    ("Salute & Farmacia", [
        "farmacia", "farmaco", "parafarmacia", "medico", "dottore", "visita",
        "laboratorio", "analisi", "dentista", "oculista", "fisioterapia",
        "ospedale", "clinica", "guardia medica", "sanitaria", "studio pizzi",
        "studio medico", "studio dentistico", "stp ",
    ]),
    ("Shopping", [
        "amazon", "zalando", "h&m", "hm it", "zara", "pull&bear", "pull & bear",
        "primark", "ikea", "leroy merlin", "decathlon", "mediaworld",
        "unieuro", "euronics", "trony", "bershka", "shein", "asos",
        "intimissimi", "calzedonia", "oysho", "mango", "uniqlo",
        "coin", "rinascente", "libreria", "feltrinelli", "mondadori",
        "tezenis", "camicissima", "bestseller", "jack & jones", "jack&jones",
        "vero moda", "only ", "name it", "selected",
    ]),
    ("Abbonamenti & Digitale", [
        "netflix", "spotify", "apple", "disney", "dazn", "now tv",
        "paramount", "mubi", "amazon prime", "prime video",
        "google*google one", "google*google play", "google one", "google play",
        "icloud", "dropbox", "claude.ai", "openai", "chatgpt", "adobe",
        "microsoft", "antivirus", "vpn", "abbonamento",
    ]),
    ("Utenze & Casa", [
        "enel", "a2a", "iren", "snam", "hera", "acea",
        "vodafone", "tim", "wind", "fastweb", "iliad",
        "affitto", "condominio", "amministratore", "mutuo",
        "bricoman", "brico",
    ]),
    ("Banca & Finanza", [
        "commissione", "commis.", "interessi", "prelievo", "bancomat",
        "addebito bonifico", "accredito bonifico", "bonifico instant",
        "canone conto", "spese tenuta", "f24", "tribut", "tassa", "imposta",
    ]),
    ("Benessere & Sport", [
        "palestra", "gym", "fitness", "piscina", "sport", "tennis", "yoga",
        "pilates", "crossfit", "parrucchiere", "barbiere", "estetista",
        "nail", "spa", "massaggio", "centro estetico",
    ]),
    ("Viaggi & Hotel", [
        "hotel", "booking", "airbnb", "hostel", "b&b", "agriturismo",
        "camping", "villaggio", "resort", "expedia", "lastminute",
    ]),
]


def categorize(description: str) -> str:
    if not description:
        return "Altro"
    desc = description.lower()
    for category, keywords in RULES:
        if any(k in desc for k in keywords):
            return category
    return "Altro"


CATEGORIES = [cat for cat, _ in RULES] + ["Altro", "Stipendio", "Entrate varie"]
