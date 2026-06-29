from __future__ import annotations

import re
import unicodedata
from collections import Counter

from db.supabase import get_client


def _norm(s: str) -> str:
    """Normalize description for comparison: unicode NFKC, lowercase, collapse whitespace."""
    s = unicodedata.normalize("NFKC", s)
    s = s.strip().lower()
    return re.sub(r"\s+", " ", s)


def _key(row: dict) -> tuple:
    return (row["date"], _norm(row["description"]), round(float(row["amount"]), 2))


def check_duplicates(rows: list[dict]) -> dict:
    """Check which rows already exist in the DB.

    Fetches all existing transactions in the date range with a single query.
    Uses a count-aware approach: if the DB has N copies of a key and the CSV
    has M, only the first N are treated as duplicates and M-N are imported.

    Returns: { new: [...], duplicates: [...] }
    """
    if not rows:
        return {"new": [], "duplicates": []}

    client = get_client()
    dates = [r["date"] for r in rows]
    min_date = min(dates)
    max_date = max(dates)

    existing_raw = (
        client.table("transactions")
        .select("date,description,amount")
        .gte("date", min_date)
        .lte("date", max_date)
        .limit(50_000)
        .execute()
        .data
    )

    # Count how many of each key already exist in the DB
    db_counts: dict[tuple, int] = dict(
        Counter(_key(r) for r in existing_raw)
    )

    new: list[dict] = []
    duplicates: list[dict] = []

    for row in rows:
        k = _key(row)
        remaining = db_counts.get(k, 0)
        if remaining > 0:
            duplicates.append(row)
            db_counts[k] = remaining - 1
        else:
            new.append(row)

    return {"new": new, "duplicates": duplicates}
