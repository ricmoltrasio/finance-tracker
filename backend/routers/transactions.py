from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from models.transaction import TransactionCreate, TransactionUpdate
from services.audit import log

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
async def list_transactions(
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
    return {"data": result.data, "total": result.count}


@router.get("/deleted")
@limiter.limit("60/minute")
async def list_deleted_transactions(
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
    return {"data": result.data, "total": len(result.data)}


@router.get("/summary")
@limiter.limit("60/minute")
async def get_summary(
    request: Request,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    _user=Depends(get_current_user),
):
    client = get_client()
    q = client.table("transactions").select("category,amount").is_("deleted_at", "null").limit(_ALL_ROWS)
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
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
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
async def set_category(
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


@router.delete("/{transaction_id}", status_code=204)
@limiter.limit("30/minute")
async def delete_transaction(
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
    await log(
        "DELETE_TRANSACTION",
        user_email,
        {"transaction_id": transaction_id, "amount": deleted.get("amount")},
        ip,
    )


@router.patch("/{transaction_id}/restore", status_code=200)
@limiter.limit("30/minute")
async def restore_transaction(
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
    return result.data[0]


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
