from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from db.supabase import get_client

_security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
):
    try:
        client = get_client()
        response = client.auth.get_user(credentials.credentials)
        return response.user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")
