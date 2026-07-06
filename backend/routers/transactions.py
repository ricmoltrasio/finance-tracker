from __future__ import annotations

import logging
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from models.transaction import TransactionCreate, TransactionUpdate
from services.audit import log
from services.geocoder import geocode_from_location

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Safe upper bound for aggregate queries — personal app won't exceed this
_ALL_ROWS = 10_000


def _warn_if_capped(rows: list, endpoint: str) -> None:
    """Il tetto _ALL_ROWS tronca in silenzio: su summary/timeline significherebbe
    un saldo sbagliato senza alcun segnale. Almeno lo si vede nei log."""
    if len(rows) >= _ALL_ROWS:
        logger.warning(
            "%s: raggiunto il tetto di %d righe — risultati troncati, saldo potenzialmente errato",
            endpoint, _ALL_ROWS,
        )


# ── helpers ───────────────────────────────────────────────────────────────────

def _date_filter(q, from_date: Optional[date], to_date: Optional[date]):
    if from_date:
        q = q.gte("date", str(from_date))
    if to_date:
        q = q.lte("date", str(to_date))
    return q


def _norm_desc(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).strip().lower()
    return re.sub(r"\s+", " ", s)


def _enrich_with_city(client, rows: list[dict]) -> list[dict]:
    """Aggiunge il campo `city` a ogni transazione.

    Priorità: override per-transazione (`loc_city`, impostato manualmente
    dal drawer) su lookup condiviso via merchant_locations.
    """
    if not rows:
        return rows
    descriptions = list({
        _norm_desc(r["description"]) for r in rows
        if r.get("description") and not r.get("loc_city")
    })
    city_map: dict[str, str] = {}
    if descriptions:
        loc_rows = (
            client.table("merchant_locations")
            .select("description,city")
            .in_("description", descriptions)
            .execute()
            .data
        )
        city_map = {r["description"]: r["city"] for r in loc_rows if r.get("city")}
    for row in rows:
        if row.get("loc_city"):
            row["city"] = row["loc_city"]
        else:
            key = _norm_desc(row.get("description", ""))
            row["city"] = city_map.get(key)
    return rows


def _get_saldo_iniziale(client) -> float:
    result = (
        client.table("settings")
        .select("value")
        .eq("key", "saldo_iniziale")
        .execute()
    )
    if not result.data:
        return 0.0
    try:
        return float(result.data[0]["value"])
    except (TypeError, ValueError):
        return 0.0


# ── endpoints ─────────────────────────────────────────────────────────────────

_SORT_COLUMNS = {"date", "amount", "category", "description"}

@router.get("")
@limiter.limit("200/minute")
def list_transactions(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("date"),
    sort_dir: str = Query("desc"),
    _user=Depends(get_current_user),
):
    if sort_by not in _SORT_COLUMNS:
        sort_by = "date"
    desc = sort_dir != "asc"

    client = get_client()
    q = client.table("transactions").select("*", count="exact").is_("deleted_at", "null")  # type: ignore[arg-type]
    q = _date_filter(q, from_date, to_date)
    if category:
        q = q.eq("category", category)
    if source:
        q = q.eq("source", source)
    if search:
        q = q.ilike("description", f"%{search}%")
    result = q.order(sort_by, desc=desc).range(offset, offset + limit - 1).execute()
    return {"data": _enrich_with_city(client, result.data), "total": result.count}


@router.get("/deleted")
@limiter.limit("60/minute")
def list_deleted_transactions(
    request: Request,
    _user=Depends(get_current_user),
):
    client = get_client()
    result = (
        client.table("transactions")
        .select("*")
        .not_.is_("deleted_at", "null")
        .order("deleted_at", desc=True)
        .limit(_ALL_ROWS)
        .execute()
    )
    return {"data": _enrich_with_city(client, result.data), "total": len(result.data)}


@router.get("/summary")
@limiter.limit("60/minute")
def get_summary(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    _user=Depends(get_current_user),
):
    client = get_client()
    q = client.table("transactions").select("category,amount").is_("deleted_at", "null").limit(_ALL_ROWS)
    q = _date_filter(q, from_date, to_date)
    rows = q.execute().data
    _warn_if_capped(rows, "GET /transactions/summary")

    spese_totali = sum(abs(r["amount"]) for r in rows if r["amount"] < 0)
    entrate_totali = sum(r["amount"] for r in rows if r["amount"] > 0)

    by_cat: dict[str, dict] = {}
    for r in rows:
        cat = r["category"] or "Altro"
        if cat not in by_cat:
            by_cat[cat] = {"category": cat, "spese": 0.0, "entrate": 0.0, "n": 0}
        if r["amount"] < 0:
            by_cat[cat]["spese"] = round(by_cat[cat]["spese"] + abs(r["amount"]), 2)
        else:
            by_cat[cat]["entrate"] = round(by_cat[cat]["entrate"] + r["amount"], 2)
        by_cat[cat]["n"] += 1

    return {
        "spese_totali": round(spese_totali, 2),
        "entrate_totali": round(entrate_totali, 2),
        "per_categoria": sorted(by_cat.values(), key=lambda x: x["spese"], reverse=True),
    }


@router.get("/timeline")
@limiter.limit("60/minute")
def get_timeline(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    granularity: str = Query("day", pattern="^(day|week|month)$"),
    category: Optional[str] = None,
    spending: bool = False,
    _user=Depends(get_current_user),
):
    client = get_client()

    def bucket_key(d_str: str) -> str:
        if granularity == "week":
            dt = date.fromisoformat(d_str)
            return str(dt - timedelta(days=dt.weekday()))
        if granularity == "month":
            return d_str[:7]
        return d_str

    if category or spending:
        q = (
            client.table("transactions")
            .select("date,amount")
            .is_("deleted_at", "null")
            .limit(_ALL_ROWS)
            .order("date")
        )
        if category:
            q = q.eq("category", category)
        if from_date:
            q = q.gte("date", str(from_date))
        if to_date:
            q = q.lte("date", str(to_date))
        rows = q.execute().data
        _warn_if_capped(rows, "GET /transactions/timeline (spending)")
        buckets: dict[str, float] = {}
        for r in rows:
            if spending and r["amount"] >= 0:
                continue
            k = bucket_key(r["date"])
            buckets[k] = buckets.get(k, 0.0) + abs(r["amount"])
        timeline = [
            {"date": d, "saldo_cumulativo": round(buckets[d], 2)}
            for d in sorted(buckets)
        ]
        return {"data": timeline, "saldo_iniziale": 0}

    saldo_iniziale = _get_saldo_iniziale(client)

    # Fetch ALL non-deleted transactions up to to_date so the running balance is accurate
    q = (
        client.table("transactions")
        .select("date,amount")
        .is_("deleted_at", "null")
        .limit(_ALL_ROWS)
        .order("date")
    )
    if to_date:
        q = q.lte("date", str(to_date))
    rows = q.execute().data
    _warn_if_capped(rows, "GET /transactions/timeline")

    buckets2: dict[str, float] = {}
    for r in rows:
        k = bucket_key(r["date"])
        buckets2[k] = buckets2.get(k, 0.0) + r["amount"]

    from_key = bucket_key(str(from_date)) if from_date else None
    running = saldo_iniziale
    timeline = []
    for d in sorted(buckets2):
        running += buckets2[d]
        if from_key is None or d >= from_key:
            timeline.append({"date": d, "saldo_cumulativo": round(running, 2)})

    return {"data": timeline, "saldo_iniziale": saldo_iniziale}


@router.post("", status_code=201)
@limiter.limit("60/minute")
def create_transaction(
    request: Request,
    body: TransactionCreate,
    _user=Depends(get_current_user),
):
    client = get_client()
    data = body.model_dump()
    data["date"] = str(data["date"])
    result = client.table("transactions").insert(data).execute()
    return result.data[0]


@router.put("/{transaction_id}")
@limiter.limit("60/minute")
def update_transaction(
    request: Request,
    transaction_id: int,
    body: TransactionUpdate,
    _user=Depends(get_current_user),
):
    client = get_client()
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

    # L'importo di una transazione divisa non è modificabile: la somma delle
    # parti in split_items non corrisponderebbe più all'originale.
    if "amount" in updates:
        tx = (
            client.table("transactions")
            .select("is_split")
            .eq("id", transaction_id)
            .is_("deleted_at", "null")
            .execute()
        )
        if not tx.data:
            raise HTTPException(status_code=404, detail="Transazione non trovata")
        if tx.data[0].get("is_split"):
            raise HTTPException(
                status_code=400,
                detail="Transazione divisa: l'importo non è modificabile",
            )

    result = (
        client.table("transactions")
        .update(updates)
        .eq("id", transaction_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    return result.data[0]


class CategoryBody(BaseModel):
    category: str
    only_this: bool = False
    ids: Optional[list[int]] = None  # se presente, aggiorna solo questi ID specifici


@router.patch("/{transaction_id}/category")
@limiter.limit("120/minute")
def set_category(
    request: Request,
    transaction_id: int,
    body: CategoryBody,
    dry_run: bool = False,
    _user=Depends(get_current_user),
):
    client = get_client()

    tx = (
        client.table("transactions")
        .select("description")
        .eq("id", transaction_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not tx.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    if body.only_this:
        if not dry_run:
            result = (
                client.table("transactions")
                .update({"category": body.category})
                .eq("id", transaction_id)
                .execute()
            )
        return {"updated": 1, "transactions": []}

    description = tx.data[0]["description"]
    pattern = description.lower().strip()

    affected = (
        client.table("transactions")
        .select("id,date,description,amount,category")
        .eq("description", description)
        .is_("deleted_at", "null")
        .execute()
    )

    if dry_run:
        return {"updated": len(affected.data), "transactions": affected.data}

    client.table("user_rules").upsert(
        {"pattern": pattern, "category": body.category},
        on_conflict="pattern",
    ).execute()

    if body.ids is not None:
        result = (
            client.table("transactions")
            .update({"category": body.category})
            .in_("id", body.ids)
            .is_("deleted_at", "null")
            .execute()
        )
    else:
        result = (
            client.table("transactions")
            .update({"category": body.category})
            .eq("description", description)
            .is_("deleted_at", "null")
            .execute()
        )

    return {"updated": len(result.data), "transactions": []}


class LocationBody(BaseModel):
    city: Optional[str] = None  # vuoto/assente = rimuove la posizione
    only_this: bool = False
    ids: Optional[list[int]] = None  # se presente, aggiorna solo questi ID specifici


@router.put("/{transaction_id}/location")
@limiter.limit("120/minute")
def set_location(
    request: Request,
    transaction_id: int,
    body: LocationBody,
    dry_run: bool = False,
    _user=Depends(get_current_user),
):
    client = get_client()

    tx = (
        client.table("transactions")
        .select("description")
        .eq("id", transaction_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not tx.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    city = (body.city or "").strip()
    clearing = not city

    if clearing:
        loc_fields: dict = {"loc_city": None, "loc_lat": None, "loc_lng": None}
    else:
        geocoded = geocode_from_location(city)
        if not geocoded:
            raise HTTPException(status_code=422, detail=f"Città '{city}' non riconosciuta")
        loc_fields = {"loc_city": geocoded["city"], "loc_lat": geocoded["lat"], "loc_lng": geocoded["lng"]}

    if body.only_this:
        if not dry_run:
            client.table("transactions").update(loc_fields).eq("id", transaction_id).execute()
        return {"updated": 1, "transactions": []}

    description = tx.data[0]["description"]

    affected = (
        client.table("transactions")
        .select("id,date,description,amount,category")
        .eq("description", description)
        .is_("deleted_at", "null")
        .execute()
    )

    if dry_run:
        return {"updated": len(affected.data), "transactions": affected.data}

    desc_norm = _norm_desc(description)
    if clearing:
        # Rimuove anche la voce condivisa così i futuri import non la ereditano
        client.table("merchant_locations").delete().eq("description", desc_norm).execute()
    else:
        client.table("merchant_locations").upsert(
            {
                "description": desc_norm,
                "city": loc_fields["loc_city"],
                "lat": loc_fields["loc_lat"],
                "lng": loc_fields["loc_lng"],
                "source": "manual",
            },
            on_conflict="description",
        ).execute()

    target_ids = body.ids if body.ids is not None else [r["id"] for r in affected.data]
    result = (
        client.table("transactions")
        .update(loc_fields)
        .in_("id", target_ids)
        .is_("deleted_at", "null")
        .execute()
    )

    return {"updated": len(result.data), "transactions": []}


@router.delete("/{transaction_id}", status_code=204)
@limiter.limit("30/minute")
def delete_transaction(
    request: Request,
    transaction_id: int,
    _user=Depends(get_current_user),
):
    client = get_client()
    deleted_at = datetime.now(timezone.utc).isoformat()
    result = (
        client.table("transactions")
        .update({"deleted_at": deleted_at})
        .eq("id", transaction_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    deleted = result.data[0]
    log(
        "DELETE_TRANSACTION",
        user_email,
        {"transaction_id": transaction_id, "amount": deleted.get("amount")},
        ip,
    )


@router.patch("/{transaction_id}/restore", status_code=200)
@limiter.limit("30/minute")
def restore_transaction(
    request: Request,
    transaction_id: int,
    _user=Depends(get_current_user),
):
    client = get_client()
    result = (
        client.table("transactions")
        .update({"deleted_at": None})
        .eq("id", transaction_id)
        .not_.is_("deleted_at", "null")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata o già attiva")

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    restored = result.data[0]
    log(
        "RESTORE_TRANSACTION",
        user_email,
        {"transaction_id": transaction_id, "amount": restored.get("amount")},
        ip,
    )
    return restored


# ── split ─────────────────────────────────────────────────────────────────────

class SplitItem(BaseModel):
    category: str
    amount: float
    note: str = ""


class SplitBody(BaseModel):
    items: list[SplitItem]


@router.post("/{transaction_id}/split", status_code=201)
@limiter.limit("30/minute")
def split_transaction(
    request: Request,
    transaction_id: int,
    body: SplitBody,
    _user=Depends(get_current_user),
):
    if len(body.items) < 2:
        raise HTTPException(status_code=400, detail="Servono almeno 2 parti per lo split")

    client = get_client()

    tx = (
        client.table("transactions")
        .select("amount,is_split")
        .eq("id", transaction_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not tx.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    if tx.data[0].get("is_split"):
        raise HTTPException(status_code=400, detail="Transazione già divisa")

    original = float(tx.data[0]["amount"])
    total_split = sum(item.amount for item in body.items)

    if abs(total_split - original) > 0.01:
        diff = round(abs(original - total_split), 2)
        raise HTTPException(status_code=400, detail=f"Differenza: €{diff:.2f}")

    # Prima le parti, poi il flag: se l'insert fallisce non resta una
    # transazione marcata "divisa" senza parti (Supabase REST non ha
    # transazioni SQL). Se invece fallisce il flag, si ripuliscono le parti.
    items_data = [
        {
            "transaction_id": transaction_id,
            "category": item.category,
            "amount": item.amount,
            "note": item.note,
        }
        for item in body.items
    ]
    client.table("split_items").insert(items_data).execute()

    try:
        client.table("transactions").update({"is_split": True}).eq("id", transaction_id).execute()
    except Exception:
        client.table("split_items").delete().eq("transaction_id", transaction_id).execute()
        raise

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    log(
        "SPLIT_CREATED",
        user_email,
        {"transaction_id": transaction_id, "parts": len(body.items)},
        ip,
    )

    return {"transaction_id": transaction_id, "parts": len(body.items)}
