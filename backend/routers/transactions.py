from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from models.transaction import TransactionCreate, TransactionUpdate
from services.audit import log
from services.categorizer import categorize

router = APIRouter(prefix="/transactions", tags=["transactions"])

# Safe upper bound for aggregate queries — personal app won't exceed this
_ALL_ROWS = 10_000


# ── helpers ───────────────────────────────────────────────────────────────────

def _date_filter(q, from_date: Optional[date], to_date: Optional[date]):
    if from_date:
        q = q.gte("date", str(from_date))
    if to_date:
        q = q.lte("date", str(to_date))
    return q


def _get_saldo_iniziale(client) -> float:
    result = (
        client.table("settings")
        .select("value")
        .eq("key", "saldo_iniziale")
        .execute()
    )
    return float(result.data[0]["value"]) if result.data else 0.0


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
@limiter.limit("200/minute")
async def list_transactions(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    category: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    _user=Depends(get_current_user),
):
    client = get_client()
    q = client.table("transactions").select("*", count="exact")
    q = _date_filter(q, from_date, to_date)
    if category:
        q = q.eq("category", category)
    if source:
        q = q.eq("source", source)
    if search:
        q = q.ilike("description", f"%{search}%")
    result = q.order("date", desc=True).range(offset, offset + limit - 1).execute()
    return {"data": result.data, "total": result.count}


@router.get("/summary")
@limiter.limit("60/minute")
async def get_summary(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    _user=Depends(get_current_user),
):
    client = get_client()
    q = client.table("transactions").select("category,amount").limit(_ALL_ROWS)
    q = _date_filter(q, from_date, to_date)
    rows = q.execute().data

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
async def get_timeline(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    granularity: str = Query("day", pattern="^(day|month)$"),
    _user=Depends(get_current_user),
):
    client = get_client()
    saldo_iniziale = _get_saldo_iniziale(client)

    # Fetch ALL transactions up to to_date so the running balance is accurate
    # even when from_date cuts the view mid-history.
    q = (
        client.table("transactions")
        .select("date,amount")
        .limit(_ALL_ROWS)
        .order("date")
    )
    if to_date:
        q = q.lte("date", str(to_date))
    rows = q.execute().data

    # Aggregate by day or month bucket
    buckets: dict[str, float] = {}
    for r in rows:
        key = r["date"][:7] if granularity == "month" else r["date"][:10]
        buckets[key] = buckets.get(key, 0.0) + r["amount"]

    # Build cumulative balance; output only keys >= from_date
    from_key = (
        str(from_date)[:7 if granularity == "month" else 10] if from_date else None
    )
    running = saldo_iniziale
    timeline = []
    for d in sorted(buckets):
        running += buckets[d]
        if from_key is None or d >= from_key:
            timeline.append({"date": d, "saldo_cumulativo": round(running, 2)})

    return {"data": timeline, "saldo_iniziale": saldo_iniziale}


@router.post("", status_code=201)
@limiter.limit("60/minute")
async def create_transaction(
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
async def update_transaction(
    request: Request,
    transaction_id: int,
    body: TransactionUpdate,
    _user=Depends(get_current_user),
):
    client = get_client()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = (
        client.table("transactions")
        .update(updates)
        .eq("id", transaction_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")
    return result.data[0]


@router.delete("/{transaction_id}", status_code=204)
@limiter.limit("30/minute")
async def delete_transaction(
    request: Request,
    transaction_id: int,
    _user=Depends(get_current_user),
):
    client = get_client()
    result = (
        client.table("transactions")
        .delete()
        .eq("id", transaction_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    deleted = result.data[0]
    await log(
        "DELETE_TRANSACTION",
        user_email,
        {"transaction_id": transaction_id, "amount": deleted.get("amount")},
        ip,
    )


# ── split ─────────────────────────────────────────────────────────────────────

class SplitItem(BaseModel):
    category: str
    amount: float
    note: str = ""


class SplitBody(BaseModel):
    items: list[SplitItem]


@router.post("/{transaction_id}/split", status_code=201)
@limiter.limit("30/minute")
async def split_transaction(
    request: Request,
    transaction_id: int,
    body: SplitBody,
    _user=Depends(get_current_user),
):
    if len(body.items) < 2:
        raise HTTPException(status_code=400, detail="Servono almeno 2 parti per lo split")

    client = get_client()

    tx = client.table("transactions").select("amount").eq("id", transaction_id).execute()
    if not tx.data:
        raise HTTPException(status_code=404, detail="Transazione non trovata")

    original = float(tx.data[0]["amount"])
    total_split = sum(item.amount for item in body.items)

    if abs(total_split - original) > 0.01:
        diff = round(abs(original - total_split), 2)
        raise HTTPException(status_code=400, detail=f"Differenza: €{diff:.2f}")

    client.table("transactions").update({"is_split": True}).eq("id", transaction_id).execute()

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

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    await log(
        "SPLIT_CREATED",
        user_email,
        {"transaction_id": transaction_id, "parts": len(body.items)},
        ip,
    )

    return {"transaction_id": transaction_id, "parts": len(body.items)}
