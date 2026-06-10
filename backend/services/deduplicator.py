from __future__ import annotations

from db.supabase import get_client


def check_duplicates(rows: list[dict]) -> dict:
    """Check which rows already exist in the DB.

    Fetches all existing transactions in the date range with a single query,
    then does O(1) lookups. Also prevents intra-batch duplicates.

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

    existing_set: set[tuple] = {
        (r["date"], r["description"].strip().lower(), round(float(r["amount"]), 2))
        for r in existing_raw
    }

    new: list[dict] = []
    duplicates: list[dict] = []

    for row in rows:
        key = (row["date"], row["description"].strip().lower(), round(float(row["amount"]), 2))
        if key in existing_set:
            duplicates.append(row)
        else:
            new.append(row)
            existing_set.add(key)

    return {"new": new, "duplicates": duplicates}
