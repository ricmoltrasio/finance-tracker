from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter

router = APIRouter(prefix="/settings", tags=["settings"])

_ALLOWED_KEYS = {"saldo_iniziale", "valuta", "default_import_profile"}

_CAST = {"numeric": float, "integer": int, "text": str}


@router.get("")
@limiter.limit("60/minute")
async def get_settings(request: Request, _user=Depends(get_current_user)):
    client = get_client()
    rows = client.table("settings").select("key,value,value_type").execute().data
    return {
        r["key"]: _CAST.get(r["value_type"], str)(r["value"]) for r in rows
    }


class SettingUpdate(BaseModel):
    value: str


@router.put("/{key}")
@limiter.limit("30/minute")
async def update_setting(
    request: Request,
    key: str,
    body: SettingUpdate,
    _user=Depends(get_current_user),
):
    if key not in _ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail=f"Chiave non valida: {key}")
    client = get_client()
    result = client.table("settings").update({"value": body.value}).eq("key", key).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Impostazione non trovata")
    return result.data[0]
