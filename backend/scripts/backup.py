"""Backup completo del DB Supabase in un singolo JSON.

Uso locale (da backend/):   python scripts/backup.py [--out CARTELLA]
Uso in CI: workflow nel repo privato finance-tracker-backup (vedi docs/backup.md).

Richiede SUPABASE_URL e SUPABASE_KEY (service role) nell'ambiente o in .env.
Sole letture: non modifica nulla. Il file di output è deterministico (righe
ordinate) così i diff tra un backup e il successivo restano leggibili in git.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# tabella -> colonna di ordinamento (output stabile per diff puliti)
TABLES: dict[str, str] = {
    "categories": "id",
    "settings": "key",
    "user_rules": "id",
    "import_profiles": "id",
    "merchant_locations": "id",
    "transactions": "id",
    "split_items": "id",
    "audit_log": "id",
}

# PostgREST tronca ogni risposta a max-rows: si pagina sempre, qualunque sia
# la dimensione del DB.
PAGE = 1000


def fetch_all(client, table: str, order_col: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        page = (
            client.table(table)
            .select("*")
            .order(order_col)
            .range(offset, offset + PAGE - 1)
            .execute()
            .data
        )
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        offset += PAGE


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup del DB in un JSON")
    parser.add_argument("--out", default="backups", help="cartella di destinazione")
    args = parser.parse_args()

    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("SUPABASE_URL / SUPABASE_KEY mancanti (ambiente o .env)", file=sys.stderr)
        return 1
    client = create_client(url, key)

    dump: dict = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "tables": {},
    }
    for table, order_col in TABLES.items():
        rows = fetch_all(client, table, order_col)
        dump["tables"][table] = rows
        print(f"{table}: {len(rows)} righe")

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / "backup.json"
    out_file.write_text(
        json.dumps(dump, ensure_ascii=False, indent=1, default=str),
        encoding="utf-8",
    )
    print(f"\nScritto {out_file} ({out_file.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
