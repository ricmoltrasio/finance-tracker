from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from services.audit import log
from services.categorizer import categorize
from services.category_keywords import (
    HARDCODED_KEYWORDS,
    load_db_categories,
    load_user_rules,
)

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    keywords: list[str] = []
    color: str = "#6C9BCF"
    icon: str = "🏷️"
    budget: Optional[float] = Field(default=None, ge=0)
    is_income: bool = False


class CategoryUpdate(BaseModel):
    keywords: Optional[list[str]] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    budget: Optional[float] = Field(default=None, ge=0)


@router.get("")
@limiter.limit("60/minute")
async def list_categories(request: Request, _user=Depends(get_current_user)):
    client = get_client()
    rows = (
        client.table("categories")
        .select("*")
        .order("is_income")
        .order("name")
        .execute()
        .data
    )
    # Lazy seed: if a category has no keywords in DB, write the hardcoded ones
    to_seed = [r for r in rows if not r.get("keywords") and r["name"] in HARDCODED_KEYWORDS]
    for row in to_seed:
        kws = HARDCODED_KEYWORDS[row["name"]]
        client.table("categories").update({"keywords": kws}).eq("id", row["id"]).execute()
        row["keywords"] = kws
    return rows


@router.post("", status_code=201)
@limiter.limit("20/minute")
async def create_category(
    request: Request, body: CategoryCreate, _user=Depends(get_current_user)
):
    client = get_client()
    result = client.table("categories").insert(body.model_dump()).execute()
    return result.data[0]


@router.put("/{category_id}")
@limiter.limit("30/minute")
async def update_category(
    request: Request,
    category_id: int,
    body: CategoryUpdate,
    _user=Depends(get_current_user),
):
    client = get_client()
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    result = (
        client.table("categories").update(updates).eq("id", category_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Categoria non trovata")

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    await log("CATEGORY_UPDATED", user_email, {"category_id": category_id}, ip)

    return result.data[0]


@router.delete("/{category_id}", status_code=204)
@limiter.limit("20/minute")
async def delete_category(
    request: Request, category_id: int, _user=Depends(get_current_user)
):
    client = get_client()
    client.table("categories").delete().eq("id", category_id).execute()


@router.post("/recategorize-all")
@limiter.limit("5/minute")
async def recategorize_all(request: Request, _user=Depends(get_current_user)):
    client = get_client()

    # Load DB categories and user rules so categorize() uses the same keywords shown in UI
    db_categories = load_db_categories(client)
    user_rules = load_user_rules(client)

    rows = (
        client.table("transactions")
        .select("id,description,amount")
        .limit(50_000)
        .execute()
        .data
    )

    # Group IDs by new category to minimize DB calls (1 per category)
    by_cat: dict[str, list[int]] = {}
    for row in rows:
        cat = categorize(row["description"], float(row["amount"]), user_rules, db_categories)
        by_cat.setdefault(cat, []).append(row["id"])

    updated = 0
    for cat, ids in by_cat.items():
        client.table("transactions").update({"category": cat}).in_("id", ids).execute()
        updated += len(ids)

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    await log("RECATEGORIZE_ALL", user_email, {"updated": updated}, ip)

    return {"updated": updated}
