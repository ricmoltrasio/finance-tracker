import sqlite3
import pandas as pd
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "finance.db"


def get_connection():
    DB_PATH.parent.mkdir(exist_ok=True)
    return sqlite3.connect(DB_PATH)


def init_db():
    con = get_connection()
    con.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            date        TEXT NOT NULL,
            description TEXT,
            amount      REAL NOT NULL,
            category    TEXT DEFAULT 'Altro',
            source      TEXT DEFAULT 'manuale',  -- 'import' o 'manuale'
            note        TEXT
        )
    """)
    con.commit()
    con.close()


def load_transactions() -> pd.DataFrame:
    init_db()
    con = get_connection()
    df = pd.read_sql("SELECT * FROM transactions ORDER BY date DESC", con)
    con.close()
    if not df.empty:
        df["date"] = pd.to_datetime(df["date"])
    return df


def insert_transaction(date, description, amount, category, source="manuale", note=""):
    init_db()
    con = get_connection()
    con.execute(
        "INSERT INTO transactions (date, description, amount, category, source, note) VALUES (?,?,?,?,?,?)",
        (str(date), description, amount, category, source, note),
    )
    con.commit()
    con.close()


def delete_transaction(tx_id: int):
    con = get_connection()
    con.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    con.commit()
    con.close()


def bulk_insert(df: pd.DataFrame):
    """Insert a cleaned DataFrame — skips duplicates by (date, description, amount)."""
    existing = load_transactions()
    inserted = 0
    con = get_connection()
    for _, row in df.iterrows():
        if not existing.empty:
            dup = existing[
                (existing["date"].astype(str).str[:10] == str(row["date"])[:10])
                & (existing["description"] == row["description"])
                & (existing["amount"] == row["amount"])
            ]
            if not dup.empty:
                continue
        con.execute(
            "INSERT INTO transactions (date, description, amount, category, source, note) VALUES (?,?,?,?,?,?)",
            (str(row["date"])[:10], row["description"], row["amount"], row.get("category", "Altro"), "import", ""),
        )
        inserted += 1
    con.commit()
    con.close()
    return inserted


def update_category(tx_id: int, category: str):
    con = get_connection()
    con.execute("UPDATE transactions SET category = ? WHERE id = ?", (category, tx_id))
    con.commit()
    con.close()