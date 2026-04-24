import os
import pandas as pd

def _get_credentials():
    """Legge le credenziali da Streamlit secrets (cloud) o variabili d'ambiente (locale)."""
    try:
        import streamlit as st
        url = st.secrets["SUPABASE_URL"]
        key = st.secrets["SUPABASE_KEY"]
    except Exception:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_KEY", "")
    return url, key


def get_client():
    from supabase import create_client
    url, key = _get_credentials()
    return create_client(url, key)


def init_db():
    pass  # tabella creata manualmente su Supabase


def load_transactions() -> pd.DataFrame:
    client = get_client()
    res = client.table("transactions").select("*").order("date", desc=True).execute()
    if not res.data:
        return pd.DataFrame(columns=["id","date","description","amount","category","source","note"])
    df = pd.DataFrame(res.data)
    df["date"] = pd.to_datetime(df["date"])
    return df


def insert_transaction(date, description, amount, category, source="manuale", note=""):
    client = get_client()
    client.table("transactions").insert({
        "date":        str(date)[:10],
        "description": description,
        "amount":      float(amount),
        "category":    category,
        "source":      source,
        "note":        note or "",
    }).execute()


def delete_transaction(tx_id: int):
    client = get_client()
    client.table("transactions").delete().eq("id", tx_id).execute()


def update_category(tx_id: int, category: str):
    client = get_client()
    client.table("transactions").update({"category": category}).eq("id", tx_id).execute()


def bulk_insert(df: pd.DataFrame) -> int:
    client = get_client()
    existing = load_transactions()
    rows = []
    for _, row in df.iterrows():
        if not existing.empty:
            dup = existing[
                (existing["date"].astype(str).str[:10] == str(row["date"])[:10])
                & (existing["description"] == row["description"])
                & (existing["amount"] == float(row["amount"]))
            ]
            if not dup.empty:
                continue
        rows.append({
            "date":        str(row["date"])[:10],
            "description": row["description"],
            "amount":      float(row["amount"]),
            "category":    row.get("category", "Altro"),
            "source":      "import",
            "note":        "",
        })
    if rows:
        client.table("transactions").insert(rows).execute()
    return len(rows)
