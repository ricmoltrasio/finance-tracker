from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from services.audit import log
from services.categorizer import categorize

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryCreate(BaseModel):
    name: str
    keywords: list[str] = []
    color: str = "#6C9BCF"
    icon: str = "🏷️"
    budget: Optional[float] = None
    is_income: bool = False


class CategoryUpdate(BaseModel):
    keywords: Optional[list[str]] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    budget: Optional[float] = None


@router.get("")
@limiter.limit("60/minute")
async def list_categories(request: Request, _user=Depends(get_current_user)):
    client = get_client()
    return (
        client.table("categories")
        .select("*")
        .order("is_income")
        .order("name")
        .execute()
        .data
    )


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
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
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
        cat = categorize(row["description"], float(row["amount"]))
        by_cat.setdefault(cat, []).append(row["id"])

    updated = 0
    for cat, ids in by_cat.items():
        client.table("transactions").update({"category": cat}).in_("id", ids).execute()
        updated += len(ids)

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    await log("RECATEGORIZE_ALL", user_email, {"updated": updated}, ip)

    return {"updated": updated}
