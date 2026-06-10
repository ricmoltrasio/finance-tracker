from __future__ import annotations

import io
from datetime import datetime
from typing import Optional

import pandas as pd

DATE_FORMATS = [
    '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%d.%m.%Y',
    '%d/%m/%y', '%d-%m-%y', '%Y/%m/%d',
]


def parse_file_to_rows(file_bytes: bytes, filename: str) -> dict:
    """Parse uploaded file and return raw rows with original column names.

    Returns: { columns, sample (first 5), raw_rows (all), suggested_profile }
    """
    df = _read_file(file_bytes, filename)
    columns = list(df.columns)
    raw_rows = df.fillna('').astype(str).to_dict('records')
    return {
        "columns": columns,
        "sample": raw_rows[:5],
        "raw_rows": raw_rows,
        "suggested_profile": _detect_profile(columns),
    }


def map_rows(
    raw_rows: list[dict],
    col_date: str,
    col_desc: str,
    amount_format: str,
    col_amount: Optional[str] = None,
    col_dare: Optional[str] = None,
    col_avere: Optional[str] = None,
) -> list[dict]:
    """Map raw rows using the given column mapping to normalized dicts.

    Returns only valid rows (valid date + valid non-zero amount).
    """
    result = []
    for row in raw_rows:
        try:
            date_val = _parse_date(row.get(col_date, ''))
            if not date_val:
                continue

            desc = str(row.get(col_desc, '')).strip()
            if not desc or desc in ('', 'nan'):
                continue

            if amount_format == 'single':
                amount = _parse_amount(row.get(col_amount, ''))
            else:
                dare = _parse_amount(row.get(col_dare, ''))
                avere = _parse_amount(row.get(col_avere, ''))
                if dare and dare != 0:
                    amount = -abs(dare)
                elif avere and avere != 0:
                    amount = abs(avere)
                else:
                    continue

            if amount is None or amount == 0:
                continue

            result.append({
                "date": date_val,
                "description": desc,
                "amount": round(amount, 2),
            })
        except Exception:
            continue
    return result


# ── internal helpers ──────────────────────────────────────────────────────────

def _read_file(file_bytes: bytes, filename: str) -> pd.DataFrame:
    ext = filename.rsplit('.', 1)[-1].lower()
    if ext in ('xlsx', 'xls'):
        return pd.read_excel(io.BytesIO(file_bytes), dtype=str)

    text = _decode(file_bytes)
    sample = text[:2000]
    sep = ';' if sample.count(';') > sample.count(',') else ','
    return pd.read_csv(io.StringIO(text), sep=sep, dtype=str, skip_blank_lines=True)


def _decode(file_bytes: bytes) -> str:
    for enc in ('utf-8-sig', 'utf-8', 'latin-1', 'cp1252'):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode('latin-1', errors='replace')


def _parse_date(val) -> Optional[str]:
    s = str(val).strip().split(' ')[0].split('T')[0]
    if not s or s in ('', 'nan', 'None'):
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None


def _parse_amount(val) -> Optional[float]:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in ('', '-', 'nan', 'None'):
        return None

    negative = s.startswith('-') or (s.startswith('(') and s.endswith(')'))
    s = s.lstrip('-+').strip('()').replace('€', '').replace('$', '').replace(' ', '')
    if not s:
        return None

    last_comma = s.rfind(',')
    last_dot = s.rfind('.')
    if last_comma > last_dot:
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '')

    try:
        result = float(s)
        return -result if negative else result
    except ValueError:
        return None


_PROFILES = [
    {
        "bank_name": "Intesa Sanpaolo",
        "date_hints": ["data operazione", "data contabile"],
        "desc_hints": ["descrizione operazione", "causale"],
        "amount_hints": ["importo"],
        "amount_format": "single",
    },
    {
        "bank_name": "UniCredit",
        "date_hints": ["data", "data valuta"],
        "desc_hints": ["descrizione", "nota"],
        "amount_hints": ["importo", "accredito", "addebito"],
        "amount_format": "single",
    },
    {
        "bank_name": "Fineco",
        "date_hints": ["data"],
        "desc_hints": ["descrizione"],
        "amount_hints": ["entrate", "uscite"],
        "dare_hints": ["uscite"],
        "avere_hints": ["entrate"],
        "amount_format": "dare_avere",
    },
]


def _detect_profile(columns: list[str]) -> Optional[dict]:
    cols_lower = [c.lower().strip() for c in columns]

    for profile in _PROFILES:
        date_col = _find_col(columns, cols_lower, profile["date_hints"])
        desc_col = _find_col(columns, cols_lower, profile["desc_hints"])
        if not date_col or not desc_col:
            continue

        if profile["amount_format"] == "single":
            amount_col = _find_col(columns, cols_lower, profile["amount_hints"])
            if not amount_col:
                continue
            return {
                "bank_name": profile["bank_name"],
                "col_date": date_col,
                "col_desc": desc_col,
                "amount_format": "single",
                "col_amount": amount_col,
            }
        else:
            dare_col = _find_col(columns, cols_lower, profile.get("dare_hints", []))
            avere_col = _find_col(columns, cols_lower, profile.get("avere_hints", []))
            if not dare_col or not avere_col:
                continue
            return {
                "bank_name": profile["bank_name"],
                "col_date": date_col,
                "col_desc": desc_col,
                "amount_format": "dare_avere",
                "col_dare": dare_col,
                "col_avere": avere_col,
            }
    return None


def _find_col(columns: list[str], cols_lower: list[str], hints: list[str]) -> Optional[str]:
    for hint in hints:
        for i, c in enumerate(cols_lower):
            if hint in c:
                return columns[i]
    return None
