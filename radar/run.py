"""Nimbus radar entry point.

    python -m radar.run --dry-run                 # check every board, print what was found
    python -m radar.run --tier priority --dry-run # only priority boards, UK/Ireland only on Workday
    python -m radar.run --only "Rolls-Royce"      # one company
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from .http import Fetcher
from .models import Board, Opportunity, RawJob
from .pipeline.classify import classify, is_candidate
from .pipeline.exclusions import excluded_company
from .pipeline.names import clean_company_name
from .sources import READERS

ROOT = Path(__file__).resolve().parent.parent
BOARDS_CSV = ROOT / "data" / "seed" / "boards.csv"
DISCOVERED = ROOT / "data" / "discovered"


def load_boards(only: str | None) -> list[Board]:
    """Hand-picked boards first, then everything discovery found (same board listed once).
    Every board is checked on every run; readers decide how much to fetch for the tier."""
    boards: list[Board] = []
    seen: set[tuple[str, str]] = set()
    for path in [BOARDS_CSV, *sorted(DISCOVERED.glob("*.csv"))]:
        with path.open(newline="", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                board = Board(**{k: (v or "").strip() for k, v in row.items()})
                board.company = clean_company_name(board.company)
                key = (board.kind, board.ref.lower().rstrip("/"))
                if board.kind in READERS and key not in seen and not excluded_company(board.company):
                    seen.add(key)
                    boards.append(board)
    if only:
        boards = [b for b in boards if only.lower() in b.company.lower()]
    return boards


def board_key(board: Board) -> str:
    return f"{board.kind}|{board.ref}"


async def _read(board: Board, http: Fetcher, tier: str) -> tuple[Board, list[RawJob], str | None]:
    try:
        return board, await READERS[board.kind].fetch(board, http, tier), None
    except Exception as error:  # one broken board must never stop the others
        return board, [], f"{type(error).__name__}: {error}"


async def _passthrough(job: RawJob) -> RawJob:
    return job


async def _enrich(board: Board, job: RawJob, http: Fetcher) -> RawJob:
    reader = READERS[board.kind]
    if not hasattr(reader, "enrich"):
        return job
    try:
        return await reader.enrich(job, http)
    except Exception:
        return job


async def scan(tier: str, only: str | None) -> tuple[list[Opportunity], dict]:
    boards = load_boards(only)
    http = Fetcher()
    try:
        results = await asyncio.gather(*(_read(b, http, tier) for b in boards))
        # Jobs listed in several countries show up once per country; keep one copy
        unique: dict[str, tuple[Board, RawJob]] = {}
        for board, jobs, _ in results:
            for job in jobs:
                job.raw["board"] = board_key(board)
                if is_candidate(job):
                    unique.setdefault(job.url, (board, job))
        shortlist = list(unique.values())
        # Full descriptions (skills, closing dates) only matter for UK/Ireland roles, or when the
        # country is still unknown; roles abroad are classified from their title alone
        enriched = await asyncio.gather(*(
            _enrich(b, j, http) if j.country in (None, "GB", "IE") else _passthrough(j) for b, j in shortlist
        ))
    finally:
        await http.aclose()

    found: dict[str, Opportunity] = {}
    for job in enriched:
        opportunity = classify(job)
        if opportunity and opportunity.fingerprint not in found:
            found[opportunity.fingerprint] = opportunity

    stats = {
        "boards": len(boards),
        "board_results": [(b, err) for b, _, err in results],
        "failed": [(b.company, b.ref, err) for b, _, err in results if err],
        "jobs_seen": sum(len(jobs) for _, jobs, _ in results),
        "shortlisted": len(shortlist),
    }
    return list(found.values()), stats


def print_report(opportunities: list[Opportunity], stats: dict, seconds: float) -> None:
    order = ["placement", "internship", "spring_week", "insight", "grad_scheme", "graduate_job",
             "research", "apprenticeship", "scholarship"]
    opportunities.sort(key=lambda o: (o.country != "GB", order.index(o.kind) if o.kind in order else 99, o.company))
    for o in opportunities:
        posted = o.posted_at.strftime("%d %b") if o.posted_at else "?"
        print(f"[{o.kind}] {o.company} | {o.title} | {o.location or '-'} ({o.country or '?'}) | posted {posted}")
        print(f"    {o.apply_url}")
        tags = ", ".join(o.disciplines) or "-"
        skills = ", ".join(o.skills) or "-"
        extra = " | ROLLING: apply early" if o.rolling else ""
        closes = f" | closes {o.closes_at:%d %b %Y}" if o.closes_at else ""
        print(f"    disciplines: {tags} | skills: {skills}{closes}{extra}")

    uk = sum(1 for o in opportunities if o.country == "GB")
    print()
    print(f"Boards checked: {stats['boards']} ({len(stats['failed'])} failed) | jobs seen: {stats['jobs_seen']} "
          f"| shortlisted: {stats['shortlisted']} | opportunities: {len(opportunities)} ({uk} in the UK) "
          f"| {seconds:.0f}s")
    for company, ref, error in stats["failed"]:
        print(f"  FAILED {company} [{ref}]: {error}")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Nimbus radar")
    parser.add_argument("--tier", choices=["priority", "full"], default="full")
    parser.add_argument("--only", help="only boards whose company name contains this text")
    parser.add_argument("--dry-run", action="store_true", help="print results instead of saving them")
    args = parser.parse_args()

    started = time.monotonic()
    started_at = datetime.now(timezone.utc)
    opportunities, stats = asyncio.run(scan(args.tier, args.only))
    stats["started_at"] = started_at
    print_report(opportunities, stats, time.monotonic() - started)

    if not args.dry_run and not (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_SECRET_KEY")):
        print("Supabase keys not set yet (SUPABASE_URL / SUPABASE_SECRET_KEY); results not saved")
    elif not args.dry_run:
        from .notify.telegram import send_new
        from .store import save

        new, first_run = save(opportunities, stats, args.tier)
        send_new(new, first_run, total_tracked=len(opportunities))


if __name__ == "__main__":
    main()
