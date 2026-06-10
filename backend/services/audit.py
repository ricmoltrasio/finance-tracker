from __future__ import annotations

from db.supabase import get_client


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
        pass
