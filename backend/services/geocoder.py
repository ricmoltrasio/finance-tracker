from __future__ import annotations

import json
import logging
import re
import time
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── gazetteer ─────────────────────────────────────────────────────────────────

_DATA_FILE = Path(__file__).parent.parent / "data" / "comuni.json"


@lru_cache(maxsize=1)
def _load_gazetteer() -> dict[str, dict]:
    with open(_DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def _norm_city(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).strip().lower()
    return re.sub(r"\s+", " ", s)


def _lookup_city(name: str) -> Optional[dict]:
    gazetteer = _load_gazetteer()
    key = _norm_city(name)
    return gazetteer.get(key)


# ── sigla provincia ──────────────────────────────────────────────────────────
# Le banche spesso appendono la sigla provincia dopo il comune (es. "Saronno VA"),
# che senza filtro viene scambiata per un comune valido (la sigla "VA" risolve
# a "Varese" su Nominatim) facendo perdere il vero comune ("Saronno").

_PROVINCE_SIGLE = {
    "AG", "AL", "AN", "AO", "AP", "AQ", "AR", "AT", "AV", "BA", "BG", "BI", "BL",
    "BN", "BO", "BR", "BS", "BT", "BZ", "CA", "CB", "CE", "CH", "CL", "CN", "CO",
    "CR", "CS", "CT", "CZ", "EN", "FC", "FE", "FG", "FI", "FM", "FR", "GE", "GO",
    "GR", "IM", "IS", "KR", "LC", "LE", "LI", "LO", "LT", "LU", "MB", "MC", "ME",
    "MI", "MN", "MO", "MS", "MT", "NA", "NO", "NU", "OR", "PA", "PC", "PD", "PE",
    "PG", "PI", "PN", "PO", "PR", "PT", "PU", "PV", "PZ", "RA", "RC", "RE", "RG",
    "RI", "RM", "RN", "RO", "SA", "SI", "SO", "SP", "SR", "SS", "SV", "SU", "TA",
    "TE", "TN", "TO", "TP", "TR", "TS", "TV", "UD", "VA", "VB", "VC", "VE", "VI",
    "VR", "VT", "VV",
    # sigle storiche pre-2016, possono comparire in estratti conto datati
    "CI", "OG", "OT", "VS",
}

_TRAILING_PAREN_RE = re.compile(r"\(([A-Za-z]{2})\)\s*$")


# ── falsi positivi noti ───────────────────────────────────────────────────────
# Parole che sembrano un comune ma non lo sono in questo contesto: "Milan" (forma
# inglese) compare spesso in abbonamenti/servizi esteri e veniva risolto come
# Milano da Nominatim. "Milano" in italiano resta valido.
_EXCLUDED_CANDIDATES = {"milan"}


def _strip_trailing_province(location_str: str) -> str:
    """Rimuove la sigla provincia finale, solo se è un token a sé stante.

    'Saronno VA' -> 'Saronno', 'Milano (MI)' -> 'Milano', 'Milano(MI)' -> 'Milano'.
    Non tocca le ultime 2 lettere di una singola parola (es. 'Lainate', 'Cogliate',
    'Gerenzano' restano intatte: 'te'/'no' lì non sono un token separato).
    """
    s = location_str.strip()

    # "Città(XX)" attaccato senza spazio: isola la sigla tra parentesi
    m = _TRAILING_PAREN_RE.search(s)
    if m and m.group(1).upper() in _PROVINCE_SIGLE:
        stripped = s[: m.start()].strip()
        return stripped or s

    # "Città XX" o "Città (XX)": la sigla è l'ultimo token, separato da spazio
    tokens = s.split()
    if len(tokens) >= 2:
        last = tokens[-1].strip("()")
        if len(last) == 2 and last.upper() in _PROVINCE_SIGLE:
            return " ".join(tokens[:-1])

    return s


# ── city extraction ───────────────────────────────────────────────────────────

def extract_city(location_str: str) -> Optional[str]:
    """Estrae il nome della città da una stringa luogo come 'Penny Market Monza'.

    Strategia: rimuove un'eventuale sigla provincia finale, poi prova gli ultimi
    1, 2 e 3 token contro il gazetteer. Ritorna il nome canonico (lowercase) se
    trovato, None altrimenti.
    """
    if not location_str or not location_str.strip():
        return None

    location_str = _strip_trailing_province(location_str.strip())
    tokens = location_str.strip().split()

    for n in (1, 2, 3):
        if len(tokens) < n:
            continue
        candidate = " ".join(tokens[-n:])
        if _norm_city(candidate) in _EXCLUDED_CANDIDATES:
            continue
        if _lookup_city(candidate):
            return _norm_city(candidate)

    return None


def geocode_from_location(location_str: str) -> Optional[dict]:
    """Ritorna {city, lat, lng} per una stringa luogo come 'Penny Market Monza'.

    1. Prova il gazetteer locale (veloce, nessuna rete) — capoluoghi e comuni principali.
    2. Se assente, fallback su Nominatim (OSM) per risolvere comuni medi/piccoli
       non presenti nel bundle statico.
    """
    city = extract_city(location_str)
    if city:
        entry = _lookup_city(city)
        if entry:
            return {"city": city, "lat": entry["lat"], "lng": entry["lng"]}

    if not location_str or not location_str.strip():
        return None
    tokens = _strip_trailing_province(location_str.strip()).split()

    for n in (1, 2, 3):
        if len(tokens) < n:
            continue
        candidate = " ".join(tokens[-n:])
        if _norm_city(candidate) in _EXCLUDED_CANDIDATES:
            continue
        coords = _nominatim_lookup_city(candidate)
        if coords:
            return {"city": _norm_city(candidate), "lat": coords[0], "lng": coords[1]}

    return None


# ── Nominatim (OSM) fallback per comuni assenti dal gazetteer ──────────────────

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_NOMINATIM_DELAY = 1.1  # secondi tra chiamate (policy d'uso Nominatim: max 1 req/s)
_NOMINATIM_PLACE_TYPES = {"city", "town", "village", "hamlet", "municipality", "administrative"}

_last_nominatim_call: float = 0.0


def _nominatim_throttle() -> None:
    global _last_nominatim_call
    elapsed = time.monotonic() - _last_nominatim_call
    if elapsed < _NOMINATIM_DELAY:
        time.sleep(_NOMINATIM_DELAY - elapsed)
    _last_nominatim_call = time.monotonic()


@lru_cache(maxsize=1024)
def _nominatim_lookup_city(name: str) -> Optional[tuple[float, float]]:
    """Risolve un nome di comune italiano via Nominatim quando non è nel gazetteer.

    Cache in-process (lru_cache) per evitare query ripetute sullo stesso nome
    durante un arricchimento massivo (molti esercenti nella stessa città).
    """
    _nominatim_throttle()
    try:
        resp = httpx.get(
            _NOMINATIM_URL,
            params={
                "q": f"{name}, Italia",
                "countrycodes": "it",
                "format": "json",
                "limit": 1,
            },
            headers={"User-Agent": "FinanceTracker/1.0 (personal use)"},
            timeout=8,
        )
        resp.raise_for_status()
        results = resp.json()
        if not results:
            return None
        r = results[0]
        if r.get("type") not in _NOMINATIM_PLACE_TYPES:
            return None
        return (float(r["lat"]), float(r["lon"]))
    except Exception as exc:
        logger.warning("Nominatim fallito per '%s': %s", name, exc)
        return None


# ── Overpass POI enrichment ───────────────────────────────────────────────────

_OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_OVERPASS_TIMEOUT = 10  # secondi
_OVERPASS_DELAY = 1.1   # secondi tra chiamate (policy: max 1 req/s)

_last_overpass_call: float = 0.0


def _overpass_throttle() -> None:
    global _last_overpass_call
    elapsed = time.monotonic() - _last_overpass_call
    if elapsed < _OVERPASS_DELAY:
        time.sleep(_OVERPASS_DELAY - elapsed)
    _last_overpass_call = time.monotonic()


def enrich_with_overpass(merchant_name: str, city: str) -> Optional[dict]:
    """Cerca il POI su OpenStreetMap per ottenere coordinate precise.

    Ritorna {lat, lng} se trovato, None altrimenti.
    Rispetta il rate limit di Overpass (1 req/s).
    """
    _overpass_throttle()

    # Query Overpass: cerca nodi/way con name~merchant_name nella bbox della città
    city_entry = _lookup_city(city)
    if not city_entry:
        return None

    lat, lng = city_entry["lat"], city_entry["lng"]
    # Bounding box ~5km intorno al centroide della città
    delta = 0.045
    bbox = f"{lat - delta},{lng - delta},{lat + delta},{lng + delta}"

    # Normalizza il nome dell'esercente per la regex Overpass
    name_clean = re.sub(r"[^\w\s]", "", merchant_name, flags=re.UNICODE).strip()
    if not name_clean:
        return None

    query = f"""
[out:json][timeout:{_OVERPASS_TIMEOUT}];
(
  node["name"~"{name_clean}",i]({bbox});
  way["name"~"{name_clean}",i]({bbox});
);
out center 1;
"""

    try:
        resp = httpx.post(
            _OVERPASS_URL,
            data={"data": query},
            timeout=_OVERPASS_TIMEOUT + 5,
            headers={"User-Agent": "FinanceTracker/1.0 (personal use)"},
        )
        resp.raise_for_status()
        elements = resp.json().get("elements", [])
        if not elements:
            return None

        el = elements[0]
        if el.get("type") == "node":
            return {"lat": el["lat"], "lng": el["lon"]}
        elif "center" in el:
            return {"lat": el["center"]["lat"], "lng": el["center"]["lon"]}
        return None

    except Exception as exc:
        logger.warning("Overpass failed for '%s' in '%s': %s", merchant_name, city, exc)
        return None


# ── upsert helper (usato da import e dal router) ──────────────────────────────

def upsert_merchant_location(
    client,
    description: str,
    location_str: str,
) -> Optional[dict]:
    """Geocodifica `location_str` e salva/aggiorna `merchant_locations`.

    Non sovrascrive i record con source='manual'.
    Ritorna il record upsertato o None se non geocodificato.
    """
    result = geocode_from_location(location_str)
    if not result:
        return None

    city = result["city"]
    lat = result["lat"]
    lng = result["lng"]

    # Normalizza descrizione come fa il deduplicator
    desc_norm = re.sub(r"\s+", " ", unicodedata.normalize("NFKC", description).strip().lower())

    existing = (
        client.table("merchant_locations")
        .select("id,source")
        .eq("description", desc_norm)
        .execute()
        .data
    )
    if existing and existing[0].get("source") == "manual":
        return existing[0]

    row = {
        "description": desc_norm,
        "city": city,
        "lat": lat,
        "lng": lng,
        "source": "auto",
    }
    res = (
        client.table("merchant_locations")
        .upsert(row, on_conflict="description")
        .execute()
    )
    return res.data[0] if res.data else None
