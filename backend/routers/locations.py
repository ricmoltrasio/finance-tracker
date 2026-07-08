from __future__ import annotations

import re
import unicodedata
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from services.geocoder import geocode_from_location

router = APIRouter(prefix="/locations", tags=["locations"])

_ALL_ROWS = 10_000


def _norm_desc(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).strip().lower()
    return re.sub(r"\s+", " ", s)


# ── GET /locations/map ────────────────────────────────────────────────────────

@router.get("/map")
@limiter.limit("60/minute")
def get_map_points(
    request: Request,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    descriptions: Optional[list[str]] = Query(None),
    _user=Depends(get_current_user),
):
    """Restituisce punti geolocalizzati per il periodo, aggregati per city.

    Formato risposta:
    [{ city, lat, lng, total_amount, count, transactions: [Transaction] }]
    Le transazioni includono tutti i campi (non solo un sottoinsieme) così
    da poter essere aperte direttamente nel drawer di modifica dalla Mappa.
    """
    client = get_client()

    # 1. Prendi tutte le transazioni del periodo
    q = (
        client.table("transactions")
        .select(
            "id,date,description,amount,orig_amount,category,note,tags,source,is_split,"
            "deleted_at,loc_city,loc_lat,loc_lng"
        )
        .is_("deleted_at", "null")
        .lt("amount", 0)
        .limit(_ALL_ROWS)
        .order("date", desc=True)
    )
    if from_date:
        q = q.gte("date", from_date)
    if to_date:
        q = q.lte("date", to_date)
    if descriptions:
        q = q.in_("description", descriptions)
    tx_rows = q.execute().data
    if not tx_rows:
        return []

    # 2. Batch-lookup merchant_locations per description normalizzata
    # (solo per le transazioni senza override per-riga)
    descriptions = list({
        _norm_desc(r["description"]) for r in tx_rows
        if r.get("description") and not r.get("loc_city")
    })
    loc_rows = (
        client.table("merchant_locations")
        .select("description,city,lat,lng")
        .in_("description", descriptions)
        .not_.is_("lat", "null")
        .execute()
        .data
        if descriptions else []
    )
    loc_map: dict[str, dict] = {r["description"]: r for r in loc_rows}

    # 3. Aggrega per city
    city_buckets: dict[str, dict] = {}
    for tx in tx_rows:
        loc: Optional[dict] = None
        if tx.get("loc_city") and tx.get("loc_lat") is not None:
            loc = {"city": tx["loc_city"], "lat": tx["loc_lat"], "lng": tx["loc_lng"]}
        else:
            key = _norm_desc(tx.get("description", ""))
            loc = loc_map.get(key)
        if not loc:
            continue
        city = loc["city"]
        if city not in city_buckets:
            city_buckets[city] = {
                "city": city,
                "lat": float(loc["lat"]),
                "lng": float(loc["lng"]),
                "total_amount": 0.0,
                "count": 0,
                "transactions": [],
            }
        bucket = city_buckets[city]
        bucket["total_amount"] = round(bucket["total_amount"] + tx["amount"], 2)
        bucket["count"] += 1
        bucket["transactions"].append({
            "id": tx["id"],
            "date": tx["date"],
            "description": tx["description"],
            "amount": tx["amount"],
            "orig_amount": tx.get("orig_amount"),
            "category": tx["category"],
            "note": tx.get("note") or "",
            "tags": tx.get("tags") or [],
            "source": tx.get("source"),
            "is_split": bool(tx.get("is_split")),
            "deleted_at": tx.get("deleted_at"),
            "city": city,
        })

    return list(city_buckets.values())


# ── POST /locations/enrich ────────────────────────────────────────────────────

@router.post("/enrich")
@limiter.limit("5/minute")
def enrich_all(
    request: Request,
    _user=Depends(get_current_user),
):
    """Geocodifica retroattiva di tutte le transazioni già nel DB.

    Per ogni description distinta non ancora in merchant_locations, tenta
    extract_city + upsert. Non sovrascrive source='manual'.
    """
    client = get_client()

    tx_rows = (
        client.table("transactions")
        .select("description")
        .is_("deleted_at", "null")
        .limit(_ALL_ROWS)
        .execute()
        .data
    )
    if not tx_rows:
        return {"processed": 0, "enriched": 0}

    descriptions = list({_norm_desc(r["description"]) for r in tx_rows if r.get("description")})

    # Escludi quelle già in merchant_locations (qualunque source)
    existing = (
        client.table("merchant_locations")
        .select("description")
        .in_("description", descriptions)
        .execute()
        .data
    )
    existing_set = {r["description"] for r in existing}
    to_process = [d for d in descriptions if d not in existing_set]

    enriched = 0
    for desc in to_process:
        result = geocode_from_location(desc)
        if not result:
            continue
        row = {
            "description": desc,
            "city": result["city"],
            "lat": result["lat"],
            "lng": result["lng"],
            "source": "auto",
        }
        try:
            client.table("merchant_locations").upsert(row, on_conflict="description").execute()
            enriched += 1
        except Exception:
            pass

    return {"processed": len(to_process), "enriched": enriched}
