from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, field_validator


class TransactionCreate(BaseModel):
    date: date
    description: str
    amount: float
    category: str
    source: str = "manuale"
    note: str = ""
    tags: list[str] = []

    @field_validator("source")
    @classmethod
    def validate_source(cls, v: str) -> str:
        if v not in ("import", "manuale"):
            raise ValueError("source deve essere 'import' o 'manuale'")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "date": "2026-06-01",
                "description": "Esselunga via Monviso",
                "amount": -45.50,
                "category": "Cibo",
                "source": "manuale",
            }
        }
    }


class TransactionUpdate(BaseModel):
    category: Optional[str] = None
    note: Optional[str] = None
    tags: Optional[list[str]] = None
