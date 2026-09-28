"""Ashby job boards, e.g. slug `arthur` -> jobs.ashbyhq.com/arthur"""

from __future__ import annotations

from ..geo import country_code, guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import parse_iso


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    response = await http.get(
        f"https://api.ashbyhq.com/posting-api/job-board/{board.ref}?includeCompensation=false"
    )
    response.raise_for_status()
    jobs = []
    for job in response.json().get("jobs", []):
        location = job.get("location", "")
        address = ((job.get("address") or {}).get("postalAddress") or {})
        jobs.append(
            RawJob(
                company=board.company,
                title=job.get("title", "").strip(),
                url=job.get("jobUrl") or job.get("applyUrl", ""),
                source_kind="ashby",
                location=location,
                country=country_code(address.get("addressCountry")) or guess_country(location),
                description=job.get("descriptionPlain") or "",
                posted_at=parse_iso(job.get("publishedAt")),
                remote=job.get("isRemote"),
                raw={"employmentType": job.get("employmentType")},
            )
        )
    return jobs
