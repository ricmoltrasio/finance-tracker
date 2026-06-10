from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from services.audit import log
from services.categorizer import categorize
from services.deduplicator import check_duplicates
from services.parser import map_rows, parse_file_to_rows

router = APIRouter(prefix="/import", tags=["import"])


# ── preview ───────────────────────────────────────────────────────────────────

@router.post("/preview")
@limiter.limit("30/minute")
async def preview(
    request: Request,
    file: UploadFile = File(...),
    _user=Depends(get_current_user),
):
    contents = await file.read()
    return parse_file_to_rows(contents, file.filename or "file.csv")


# ── confirm ───────────────────────────────────────────────────────────────────

class ImportConfirmBody(BaseModel):
    col_date: str
    col_desc: str
    amount_format: str
    col_amount: Optional[str] = None
    col_dare: Optional[str] = None
    col_avere: Optional[str] = None
    raw_rows: list[dict]
    bank_name: Optional[str] = None
    profile_id: Optional[int] = None


@router.post("/confirm")
@limiter.limit("10/minute")
async def confirm(
    request: Request,
    body: ImportConfirmBody,
    _user=Depends(get_current_user),
):
    rows = map_rows(
        body.raw_rows,
        body.col_date,
        body.col_desc,
        body.amount_format,
        body.col_amount,
        body.col_dare,
        body.col_avere,
    )

    if not rows:
        raise HTTPException(status_code=400, detail="Nessuna riga valida trovata nel file")

    for row in rows:
        row["category"] = categorize(row["description"], row["amount"])
        row["source"] = "import"
        row["tags"] = []
        row["is_split"] = False
        row["note"] = ""

    dedup = check_duplicates(rows)
    new_rows = dedup["new"]
    skipped = len(dedup["duplicates"])
    errors = 0
    imported = 0

    if new_rows:
        try:
            client = get_client()
            client.table("transactions").insert(new_rows).execute()
            imported = len(new_rows)
        except Exception:
            errors = len(new_rows)

    uncategorized = sum(1 for r in new_rows if r.get("category") == "Altro")

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    await log(
        "IMPORT_COMPLETED",
        user_email,
        {"imported": imported, "skipped_duplicates": skipped, "bank": body.bank_name},
        ip,
    )

    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "uncategorized": uncategorized,
        "errors": errors,
    }


# ── import profiles ───────────────────────────────────────────────────────────

class ProfileBody(BaseModel):
    bank_name: str
    col_date: str
    col_desc: str
    amount_format: str
    col_amount: Optional[str] = None
    col_dare: Optional[str] = None
    col_avere: Optional[str] = None


@router.get("/profiles")
@limiter.limit("60/minute")
async def list_profiles(request: Request, _user=Depends(get_current_user)):
    client = get_client()
    return client.table("import_profiles").select("*").order("bank_name").execute().data


@router.post("/profiles", status_code=201)
@limiter.limit("30/minute")
async def create_profile(request: Request, body: ProfileBody, _user=Depends(get_current_user)):
    client = get_client()
    result = client.table("import_profiles").insert(body.model_dump()).execute()
    return result.data[0]


@router.put("/profiles/{profile_id}")
@limiter.limit("30/minute")
async def update_profile(
    request: Request, profile_id: int, body: ProfileBody, _user=Depends(get_current_user)
):
    client = get_client()
    result = (
        client.table("import_profiles")
        .update(body.model_dump())
        .eq("id", profile_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profilo non trovato")
    return result.data[0]


@router.delete("/profiles/{profile_id}", status_code=204)
@limiter.limit("30/minute")
async def delete_profile(request: Request, profile_id: int, _user=Depends(get_current_user)):
    client = get_client()
    client.table("import_profiles").delete().eq("id", profile_id).execute()
