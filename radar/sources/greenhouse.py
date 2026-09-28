"""Greenhouse job boards, e.g. slug `rendezvousrobotics` -> job-boards.greenhouse.io/rendezvousrobotics"""

from __future__ import annotations

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    response = await http.get(f"https://boards-api.greenhouse.io/v1/boards/{board.ref}/jobs?content=true")
    response.raise_for_status()
    jobs = []
    for job in response.json().get("jobs", []):
        location = (job.get("location") or {}).get("name", "")
        jobs.append(
            RawJob(
                company=board.company,
                title=job.get("title", "").strip(),
                url=job.get("absolute_url", ""),
                source_kind="greenhouse",
                location=location,
                country=guess_country(location),
                description=html_to_text(job.get("content")),
                posted_at=parse_iso(job.get("first_published") or job.get("updated_at")),
            )
        )
    return jobs
