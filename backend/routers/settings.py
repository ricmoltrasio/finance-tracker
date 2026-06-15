from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from db.supabase import get_client
from deps import get_current_user
from limiter import limiter

router = APIRouter(prefix="/settings", tags=["settings"])

# key -> tipo atteso del valore (validato in scrittura, castato in lettura)
_KEY_TYPES = {"saldo_iniziale": "numeric", "valuta": "text", "default_import_profile": "integer"}
_ALLOWED_KEYS = set(_KEY_TYPES)

_CAST = {"numeric": float, "integer": int, "text": str}


def _validate_value(key: str, value: str) -> None:
    """Impedisce di salvare valori non castabili che romperebbero le letture."""
    expected = _KEY_TYPES[key]
    try:
        _CAST[expected](value)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"Valore non valido per '{key}': atteso tipo {expected}",
        )


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
    _validate_value(key, body.value)
    client = get_client()
    result = client.table("settings").update({"value": body.value}).eq("key", key).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Impostazione non trovata")
    return result.data[0]
