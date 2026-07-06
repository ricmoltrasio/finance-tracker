"""Ripristina un backup.json su un progetto Supabase appena creato.

Prerequisito: aver eseguito PRIMA tutte le migration di docs/ (schema + RLS)
nel SQL Editor del nuovo progetto. Procedura completa in docs/backup.md.

Uso:  python scripts/restore.py percorso/backup.json
Richiede SUPABASE_URL e SUPABASE_KEY del progetto DI DESTINAZIONE
nell'ambiente (o in .env — attenzione a non puntare per errore al vecchio).

Note:
- Pensato per un progetto vuoto: non fa merge. Le tabelle già seminate dalle
  migration (categories, settings) vengono riallineate via upsert; le altre
  righe sono inserite così come sono, id inclusi (serve per la FK di
  split_items e per mantenere i riferimenti).
- Dopo il restore le sequence BIGSERIAL vanno riallineate: lo script stampa
  l'SQL da incollare nel SQL Editor (senza, i prossimi INSERT collidono
  sugli id già usati).
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

# Ordine di insert: prima le tabelle senza dipendenze, poi transactions,
# poi split_items (FK verso transactions).
# tabella -> colonna di conflitto per upsert (None = insert puro)
RESTORE_PLAN: list[tuple[str, str | None]] = [
    ("categories", "name"),          # seminate dalla migration -> upsert
    ("settings", "key"),             # seminate dalla migration -> upsert
    ("user_rules", "pattern"),
    ("import_profiles", None),
    ("merchant_locations", "description"),
    ("transactions", None),
    ("split_items", None),
    ("audit_log", None),
]

CHUNK = 500

SERIAL_TABLES = [
    "categories", "user_rules", "import_profiles",
    "merchant_locations", "transactions", "split_items", "audit_log",
]


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python scripts/restore.py percorso/backup.json", file=sys.stderr)
        return 1

    dump_path = Path(sys.argv[1])
    dump = json.loads(dump_path.read_text(encoding="utf-8"))
    tables: dict[str, list[dict]] = dump["tables"]
    print(f"Backup del {dump.get('exported_at', '?')}")

    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("SUPABASE_URL / SUPABASE_KEY mancanti", file=sys.stderr)
        return 1
    print(f"Destinazione: {url}")
    if input("Confermi il restore su questo progetto? [scrivi 'si'] ") != "si":
        print("Annullato.")
        return 1
    client = create_client(url, key)

    for table, conflict_col in RESTORE_PLAN:
        rows = tables.get(table, [])
        if not rows:
            print(f"{table}: vuota, salto")
            continue
        for i in range(0, len(rows), CHUNK):
            chunk = rows[i : i + CHUNK]
            if conflict_col:
                client.table(table).upsert(chunk, on_conflict=conflict_col).execute()
            else:
                client.table(table).insert(chunk).execute()
        print(f"{table}: {len(rows)} righe ripristinate")

    print("\nFATTO. Ora esegui nel SQL Editor di Supabase per riallineare le sequence:\n")
    for t in SERIAL_TABLES:
        print(
            f"SELECT setval(pg_get_serial_sequence('{t}','id'), "
            f"COALESCE((SELECT MAX(id) FROM {t}), 1));"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
