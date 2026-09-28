"""Workable boards, e.g. slug `realtime-robotics` -> apply.workable.com/realtime-robotics"""

from __future__ import annotations

from ..geo import country_code, guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    response = await http.get(f"https://apply.workable.com/api/v1/widget/accounts/{board.ref}?details=true")
    response.raise_for_status()
    jobs = []
    for job in response.json().get("jobs", []):
        location = ", ".join(p for p in (job.get("city"), job.get("state"), job.get("country")) if p)
        jobs.append(
            RawJob(
                company=board.company,
                title=job.get("title", "").strip(),
                url=job.get("url") or job.get("application_url", ""),
                source_kind="workable",
                location=location,
                country=country_code(job.get("country_code") or job.get("country")) or guess_country(location),
                description=html_to_text(job.get("description")),
                posted_at=parse_iso(job.get("published_on") or job.get("created_at")),
                remote=job.get("telecommuting"),
                raw={"employment": job.get("employment_type")},
            )
        )
    return jobs
