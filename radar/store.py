"""Saves radar results to Supabase (via its REST API) and returns the opportunities that are new."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx

from .models import Opportunity

# Sources whose posted time is exact (Workday and feeds only give the day)
PRECISE_SOURCES = {"greenhouse", "lever", "ashby", "smartrecruiters", "workable"}


def client() -> httpx.Client:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SECRET_KEY"]
    return httpx.Client(
        base_url=f"{url}/rest/v1",
        headers={"apikey": key, "Content-Type": "application/json"},
        timeout=60,
    )


def _batches(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _company_ids(db: httpx.Client) -> dict[str, str]:
    companies = db.get("/companies", params={"select": "id,name"})
    companies.raise_for_status()
    ids = {row["name"].lower(): row["id"] for row in companies.json()}
    aliases = db.get("/company_aliases", params={"select": "company_id,alias"})
    aliases.raise_for_status()
    for row in aliases.json():
        ids.setdefault(row["alias"].lower(), row["company_id"])
    return ids


def _row(o: Opportunity, company_ids: dict[str, str]) -> dict:
    return {
        "fingerprint": o.fingerprint,
        "company_id": company_ids.get(o.company.lower()),
        "company_name": o.company,
        "title": o.title,
        "kind": o.kind,
        "disciplines": o.disciplines,
        "skills": o.skills,
        "location_text": o.location or None,
        "country": o.country,
        "city": o.city,
        "remote": o.remote,
        "apply_url": o.apply_url,
        "description": o.description or None,
        "posted_at": _iso(o.posted_at),
        "closes_at": _iso(o.closes_at),
        "rolling": o.rolling,
        "source_kind": o.source_kind,
    }


def save(opportunities: list[Opportunity], stats: dict, tier: str) -> tuple[list[dict], bool]:
    """Insert new opportunities, refresh ones seen before, log the run.

    Returns (new rows, first_run). On the very first run everything is "new", so callers
    should not alert on it."""
    now = datetime.now(timezone.utc)
    with client() as db:
        previous_runs = db.get("/checker_runs", params={"select": "id", "limit": 1})
        previous_runs.raise_for_status()
        first_run = not previous_runs.json()

        company_ids = _company_ids(db)
        rows = [_row(o, company_ids) for o in opportunities]

        new: list[dict] = []
        for chunk in _batches(rows, 200):
            response = db.post(
                "/opportunities",
                params={"on_conflict": "fingerprint"},
                headers={"Prefer": "resolution=ignore-duplicates,return=representation"},
                json=chunk,
            )
            response.raise_for_status()
            new.extend(response.json())

        new_fingerprints = {row["fingerprint"] for row in new}
        seen_again = [row["fingerprint"] for row in rows if row["fingerprint"] not in new_fingerprints]
        for chunk in _batches(seen_again, 100):
            response = db.patch(
                "/opportunities",
                params={"fingerprint": f"in.({','.join(chunk)})"},
                json={"last_seen_at": now.isoformat(), "status": "open"},
            )
            response.raise_for_status()

        delays = [
            (now - datetime.fromisoformat(row["posted_at"])).total_seconds() / 60
            for row in new
            if row.get("posted_at") and row.get("source_kind") in PRECISE_SOURCES
        ]
        run = db.post(
            "/checker_runs",
            json={
                "runner": f"github:{tier}" if os.environ.get("GITHUB_ACTIONS") else f"local:{tier}",
                "started_at": stats["started_at"].isoformat(),
                "finished_at": now.isoformat(),
                "sources_checked": stats["boards"],
                "sources_failed": len(stats["failed"]),
                "new_opportunities": len(new),
                "max_detection_delay_minutes": round(max(delays)) if delays else None,
                "errors": [{"company": c, "board": b, "error": e[:300]} for c, b, e in stats["failed"]],
            },
        )
        run.raise_for_status()

    print(f"Saved: {len(new)} new, {len(seen_again)} seen again{' (first run: alerts skipped)' if first_run else ''}")
    return new, first_run
