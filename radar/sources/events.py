"""Expos, conferences, careers fairs and science festivals from data/seed/events.csv: researched by
hand from each event's own website, since there is no shared listing to read. Add a row to add an
event; rows drop out by themselves once the event is over.

`ref` is unused (`events`). Each row becomes an event, closing on its last day. `disciplines` (tags
from radar/pipeline/classify.py, `;`-separated) decides who sees it; empty means every degree."""

from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from ..http import Fetcher
from ..models import Board, RawJob

EVENTS_CSV = Path(__file__).resolve().parents[2] / "data" / "seed" / "events.csv"


def _day(value: str, end: bool = False) -> datetime | None:
    try:
        day = datetime.strptime(value.strip(), "%Y-%m-%d")
    except ValueError:
        return None
    return day.replace(hour=23, minute=59, tzinfo=timezone.utc) if end else day.replace(tzinfo=timezone.utc)


def _when(starts: datetime | None, ends: datetime | None) -> str:
    if not starts:
        return ""
    if not ends or ends.date() == starts.date():
        return f"{starts:%a %d %b %Y}"
    return f"{starts:%d %b} to {ends:%d %b %Y}"


def load(now: datetime | None = None) -> list[RawJob]:
    now = now or datetime.now(timezone.utc)
    jobs: list[RawJob] = []
    with EVENTS_CSV.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            starts, ends = _day(row["starts"]), _day(row["ends"] or row["starts"], end=True)
            if not ends or ends < now:
                continue
            kind = row["type"].strip()
            name = row["name"].strip()
            title = name if kind.lower() in name.lower() else f"{name} ({kind.lower()})"
            online = row["online"].strip().lower() in ("yes", "true", "1")
            jobs.append(
                RawJob(
                    company=row["organiser"].strip() or name,
                    title=title,
                    url=row["url"].strip(),
                    source_kind="events",
                    location="Online" if online else row["city"].strip(),
                    country=None if online else (row["country"].strip() or None),
                    remote=online,
                    description=" · ".join(p for p in (kind, _when(starts, ends), row["notes"].strip()) if p),
                    closes_at=ends,
                    raw={"employment": "event", "disciplines": [d for d in row["disciplines"].split(";") if d.strip()]},
                )
            )
    return jobs


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    return load()
