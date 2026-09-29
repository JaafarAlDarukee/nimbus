"""Company discovery: finds employers' hiring-system boards at scale, keeps the relevant ones."""

from __future__ import annotations

import csv
from pathlib import Path

from ..pipeline.exclusions import excluded_company
from ..pipeline.names import clean_company_name

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "data" / "discovered"
FIELDS = ["company", "kind", "ref", "tier", "notes"]


def save_boards(kind: str, found: list[dict]) -> int:
    """Merge newly found boards into data/discovered/<kind>.csv and return the total.

    Discovery depends on a busy public index, so a run may see only part of the web. Merging
    means a bad run can only add boards, never wipe out ones found before; boards that go dead
    are dropped by the radar's own health checks instead."""
    path = OUTPUT_DIR / f"{kind}.csv"
    merged: dict[str, dict] = {}
    if path.exists():
        with path.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                merged[row["ref"].lower().rstrip("/")] = row
    for row in found:
        merged[row["ref"].lower().rstrip("/")] = row  # newer details win
    rows = []
    for row in merged.values():
        row["company"] = clean_company_name(row["company"])
        if not excluded_company(row["company"]):
            rows.append(row)
    rows.sort(key=lambda r: r["company"].lower())
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)
