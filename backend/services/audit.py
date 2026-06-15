from __future__ import annotations

import logging

from db.supabase import get_client

logger = logging.getLogger(__name__)


async def log(action: str, user_email: str, details: dict, ip: str = "") -> None:
    """Insert an audit log entry. Never raises — audit must not break main flow."""
    try:
        client = get_client()
        client.table("audit_log").insert({
            "action": action,
            "user_email": user_email,
            "details": details,
            "ip": ip,
        }).execute()
    except Exception:
        # L'audit non deve mai bloccare il flusso principale, ma il fallimento
        # va almeno tracciato nei log applicativi.
        logger.warning("Scrittura audit_log fallita per action=%s", action, exc_info=True)
