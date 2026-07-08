from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter
from services.audit import log
from services.categorizer import categorize
from services.category_keywords import load_db_categories, load_user_rules
from services.deduplicator import check_duplicates
from services.geocoder import upsert_merchant_location
from services.parser import map_rows, parse_file_to_rows

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/import", tags=["import"])

# Limite difensivo sulla dimensione del file caricato (10 MB)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


# ── preview ───────────────────────────────────────────────────────────────────

@router.post("/preview")
@limiter.limit("30/minute")
def preview(
    request: Request,
    file: UploadFile = File(...),
    _user=Depends(get_current_user),
):
    contents = file.file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File troppo grande (max 10 MB)")
    try:
        return parse_file_to_rows(contents, file.filename or "file.csv")
    except Exception as exc:
        logger.warning("Parse fallito per %s: %s", file.filename, exc)
        raise HTTPException(status_code=422, detail=f"Impossibile leggere il file: {exc}")


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
def confirm(
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

    client = get_client()
    user_rules = load_user_rules(client)
    db_expenses, db_incomes = load_db_categories(client)

    for row in rows:
        row["category"] = categorize(row["description"], row["amount"], user_rules, db_expenses, db_incomes)
        row["source"] = "import"
        row["tags"] = []
        row["is_split"] = False
        row["note"] = ""
        # identità immutabile per la deduplicazione (vedi migration_orig_amount.sql)
        row["orig_amount"] = row["amount"]

    dedup = check_duplicates(rows)
    new_rows = dedup["new"]
    dup_rows = dedup["duplicates"]
    skipped = len(dup_rows)
    errors = 0
    imported_rows: list[dict] = []

    if new_rows:
        try:
            result = client.table("transactions").insert(new_rows).execute()
            imported_rows = result.data or []
        except Exception:
            logger.exception("Insert fallito durante l'import (%d righe)", len(new_rows))
            errors = len(new_rows)

    imported = len(imported_rows)
    uncategorized_rows = [r for r in imported_rows if r.get("category") == "Altro"]

    # Geocodifica da description (stessa colonna già letta, es. "Dettagli" di Intesa)
    for imported_row in imported_rows:
        desc = imported_row.get("description", "")
        if desc:
            try:
                upsert_merchant_location(client, desc, desc)
            except Exception:
                logger.warning("Geocodifica fallita per '%s'", desc)

    def _slim(r: dict) -> dict:
        return {
            "id": r.get("id"),
            "date": r.get("date", ""),
            "description": r.get("description", ""),
            "amount": r.get("amount", 0),
            "category": r.get("category", ""),
        }

    user_email = getattr(_user, "email", "")
    ip = request.client.host if request.client else ""
    log(
        "IMPORT_COMPLETED",
        user_email,
        {"imported": imported, "skipped_duplicates": skipped, "bank": body.bank_name},
        ip,
    )

    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "uncategorized": len(uncategorized_rows),
        "errors": errors,
        "rows": {
            "imported": [_slim(r) for r in imported_rows],
            "duplicates": [_slim(r) for r in dup_rows],
            "uncategorized": [_slim(r) for r in uncategorized_rows],
        },
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
def list_profiles(request: Request, _user=Depends(get_current_user)):
    client = get_client()
    return client.table("import_profiles").select("*").order("bank_name").execute().data


@router.post("/profiles", status_code=201)
@limiter.limit("30/minute")
def create_profile(request: Request, body: ProfileBody, _user=Depends(get_current_user)):
    client = get_client()
    result = client.table("import_profiles").insert(body.model_dump()).execute()
    return result.data[0]


@router.put("/profiles/{profile_id}")
@limiter.limit("30/minute")
def update_profile(
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
def delete_profile(request: Request, profile_id: int, _user=Depends(get_current_user)):
    client = get_client()
    client.table("import_profiles").delete().eq("id", profile_id).execute()
