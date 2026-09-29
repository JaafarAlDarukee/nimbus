"""Saves radar results to Supabase (via its REST API) and returns the opportunities that are new."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx

from .models import Opportunity

# Sources whose posted time is exact (Workday and feeds only give the day)
PRECISE_SOURCES = {"greenhouse", "lever", "ashby", "smartrecruiters", "workable", "adzuna"}


def _explain_errors(response: httpx.Response) -> None:
    """Print Supabase's own error message (never contains the key) so failures are easy to fix."""
    if response.is_error:
        print(f"Supabase said {response.status_code} for {response.request.url.path}: {response.text[:500]}")


def client() -> httpx.Client:
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SECRET_KEY"].strip()
    if key.startswith("sb_publishable_"):
        print("SUPABASE_SECRET_KEY holds the *publishable* key; it needs the sb_secret_... key instead")
    elif "•" in key or "*" in key:
        print("SUPABASE_SECRET_KEY holds the masked (dotted) text; click the copy icon to copy the real key")
    elif not key.startswith(("sb_secret_", "eyJ")):
        print("SUPABASE_SECRET_KEY isn't in a recognised key format; copy the sb_secret_... key again")
    return httpx.Client(
        base_url=f"{url}/rest/v1",
        headers={"apikey": key, "Content-Type": "application/json"},
        timeout=60,
        event_hooks={"response": [lambda r: (r.read(), _explain_errors(r))]},
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


def _fetch_all(db: httpx.Client, path: str, params: dict) -> list[dict]:
    """Read every row, 1,000 at a time (the API's page size)."""
    rows: list[dict] = []
    while True:
        response = db.get(path, params={**params, "limit": 1000, "offset": len(rows)})
        response.raise_for_status()
        batch = response.json()
        rows.extend(batch)
        if len(batch) < 1000:
            return rows


def _record_boards(db: httpx.Client, board_results: list, now: str) -> tuple[dict[str, str], set[str]]:
    """Save each board's health to `sources`. Returns (board key -> source id, keys of boards
    seen for the very first time). A new board's existing jobs aren't news, so they don't alert."""
    known = {f"{r['kind']}|{r['url']}" for r in _fetch_all(db, "/sources", {"select": "kind,url"})}
    ok = [{"kind": b.kind, "url": b.ref, "check_every_minutes": 30, "last_checked_at": now,
           "last_success_at": now, "last_error": None, "consecutive_failures": 0}
          for b, error in board_results if not error]
    failed = [{"kind": b.kind, "url": b.ref, "check_every_minutes": 30, "last_checked_at": now,
               "last_error": error[:500]}
              for b, error in board_results if error]
    ids: dict[str, str] = {}
    for rows in (ok, failed):
        for chunk in _batches(rows, 500):
            response = db.post(
                "/sources",
                params={"on_conflict": "kind,url"},
                headers={"Prefer": "resolution=merge-duplicates,return=representation"},
                json=chunk,
            )
            response.raise_for_status()
            ids.update({f"{r['kind']}|{r['url']}": r["id"] for r in response.json()})
    new_boards = {key for key in ids if key not in known}
    return ids, new_boards


def _row(o: Opportunity, company_ids: dict[str, str], source_ids: dict[str, str]) -> dict:
    return {
        "fingerprint": o.fingerprint,
        "source_id": source_ids.get(o.raw.get("board", "")),
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
    """Insert new opportunities, refresh ones seen before, record board health, log the run.

    Returns (rows worth alerting, first_run). Nothing alerts on the very first run, and jobs
    from a board checked for the first time are saved quietly (they aren't newly posted)."""
    now = datetime.now(timezone.utc)
    with client() as db:
        previous_runs = db.get("/checker_runs", params={"select": "id", "limit": 1})
        previous_runs.raise_for_status()
        first_run = not previous_runs.json()

        source_ids, new_boards = _record_boards(db, stats["board_results"], now.isoformat())
        company_ids = _company_ids(db)
        rows = [_row(o, company_ids, source_ids) for o in opportunities]
        board_of = {o.fingerprint: o.raw.get("board", "") for o in opportunities}

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

    # Worth an alert: from a board we already knew, and posted in the last week (or date unknown)
    week_ago = now - timedelta(days=7)
    alertable = [
        row for row in new
        if board_of.get(row["fingerprint"]) not in new_boards
        and (not row.get("posted_at") or datetime.fromisoformat(row["posted_at"]) >= week_ago)
    ]
    quiet = len(new) - len(alertable)
    print(f"Saved: {len(new)} new ({quiet} saved quietly: from {len(new_boards)} newly added boards "
          f"or posted over a week ago), "
          f"{len(seen_again)} seen again{' (first run: alerts skipped)' if first_run else ''}")
    return alertable, first_run
