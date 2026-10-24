"""Reed.co.uk, through its Jobseeker API (owner, 24 Oct: "not only Adzuna"). Needs REED_API_KEY
(a free key from reed.co.uk/developers, saved as a GitHub secret by the owner). Searches the student
roles engineers look for; Reed's own job pages are the apply links, marked "via Reed".

API: https://www.reed.co.uk/api/1.0/search, basic auth with the key as the username."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Board, RawJob, Skipped

SEARCHES = ["industrial placement engineering", "placement year engineer", "year in industry engineering",
            "engineering internship", "summer internship engineer", "undergraduate engineer", "engineering placement student"]
PAGES = {"priority": 1, "full": 3}
PAGE = 100


def _date(value: str | None) -> datetime | None:
    """Reed dates look like 23/10/2026."""
    try:
        return datetime.strptime(value or "", "%d/%m/%Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def job_from(result: dict) -> RawJob:
    return RawJob(
        company=(result.get("employerName") or "").strip() or "via Reed",
        title=(result.get("jobTitle") or "").strip(),
        url=result.get("jobUrl") or f"https://www.reed.co.uk/jobs/{result.get('jobId')}",
        source_kind="reed",
        location=result.get("locationName") or "",
        country="GB",
        description=result.get("jobDescription") or "",
        posted_at=_date(result.get("date")),
        closes_at=_date(result.get("expirationDate")),
    )


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    key = os.environ.get("REED_API_KEY", "").strip()
    if not key:
        raise Skipped("no Reed key yet")
    jobs: dict[str, RawJob] = {}
    for keywords in SEARCHES:
        for page in range(PAGES.get(tier, 1)):
            response = await http.get(
                "https://www.reed.co.uk/api/1.0/search",
                params={"keywords": keywords, "resultsToTake": PAGE, "resultsToSkip": page * PAGE},
                auth=(key, ""),
            )
            response.raise_for_status()
            results = response.json().get("results") or []
            for result in results:
                job = job_from(result)
                jobs.setdefault(job.url, job)
            if len(results) < PAGE:
                break
    return list(jobs.values())
