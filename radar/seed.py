"""Load data/seed/companies.csv into the companies table (safe to run again; it updates by slug).

    python -m radar.seed
"""

from __future__ import annotations

import csv
import os
import re

from .run import ROOT
from .store import client

COMPANIES_CSV = ROOT / "data" / "seed" / "companies.csv"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _list(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split(";") if part.strip()]


def main() -> None:
    if not (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SECRET_KEY")):
        print("Supabase keys not set yet (SUPABASE_URL / SUPABASE_SECRET_KEY); skipping company sync")
        return
    with COMPANIES_CSV.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    companies = []
    for row in rows:
        notes = [row["notes"].strip()] if row.get("notes", "").strip() else []
        if row.get("parent", "").strip():
            notes.insert(0, f"Parent: {row['parent'].strip()}")
        companies.append({
            "name": row["name"].strip(),
            "slug": slugify(row["name"]),
            "sectors": _list(row.get("sectors", "")),
            "regions": _list(row.get("regions", "")),
            "global_mobility": _list(row.get("global_mobility", "")),
            "tier": row.get("tier", "").strip() or "standard",
            "notes": " | ".join(notes) or None,
        })

    with client() as db:
        response = db.post(
            "/companies",
            params={"on_conflict": "slug"},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json=companies,
        )
        response.raise_for_status()
    print(f"Seeded {len(companies)} companies")


if __name__ == "__main__":
    main()
