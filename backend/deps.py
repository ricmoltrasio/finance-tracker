import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from db.supabase import get_client

_security = HTTPBearer()

# Cache breve di validazione token: evita una chiamata di rete a Supabase per
# OGNI richiesta API. TTL basso = un token revocato resta valido al massimo
# per questo intervallo (tradeoff standard, accettabile per quest'app).
_TOKEN_TTL_SECONDS = 60
_TOKEN_CACHE_MAX = 128
_token_cache: dict[str, tuple[float, object]] = {}


def _cache_get(token: str):
    entry = _token_cache.get(token)
    if entry is None:
        return None
    expires_at, user = entry
    if time.monotonic() > expires_at:
        _token_cache.pop(token, None)
        return None
    return user


def _cache_put(token: str, user) -> None:
    if len(_token_cache) >= _TOKEN_CACHE_MAX:
        # Eviction semplice: rimuove l'entry più vicina alla scadenza
        oldest = min(_token_cache, key=lambda k: _token_cache[k][0])
        _token_cache.pop(oldest, None)
    _token_cache[token] = (time.monotonic() + _TOKEN_TTL_SECONDS, user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
):
    token = credentials.credentials

    cached = _cache_get(token)
    if cached is not None:
        return cached

    try:
        client = get_client()
        response = client.auth.get_user(token)
        user = response.user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")

    if user is None:
        raise HTTPException(status_code=401, detail="Token non valido o scaduto")

    _cache_put(token, user)
    return user
