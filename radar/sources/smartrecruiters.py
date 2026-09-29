"""SmartRecruiters company boards, e.g. slug `Acme` -> jobs.smartrecruiters.com/Acme"""

from __future__ import annotations

from ..geo import country_code
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

PAGE = 100
MAX_PAGES = 20


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    jobs = []
    # Priority runs ask only for UK jobs (the API filters by lowercase country code)
    country = {"country": "gb"} if tier == "priority" else {}
    for page in range(MAX_PAGES):
        response = await http.get(
            f"https://api.smartrecruiters.com/v1/companies/{board.ref}/postings",
            params={"limit": PAGE, "offset": page * PAGE, **country},
        )
        response.raise_for_status()
        content = response.json().get("content", [])
        for posting in content:
            location = posting.get("location") or {}
            jobs.append(
                RawJob(
                    company=board.company,
                    title=posting.get("name", "").strip(),
                    url=f"https://jobs.smartrecruiters.com/{board.ref}/{posting.get('id')}",
                    source_kind="smartrecruiters",
                    location=location.get("fullLocation") or location.get("city", ""),
                    country=country_code(location.get("country")),
                    posted_at=parse_iso(posting.get("releasedDate")),
                    remote=location.get("remote"),
                    raw={
                        "detail": posting.get("ref"),
                        "experience": (posting.get("experienceLevel") or {}).get("label"),
                        "employment": (posting.get("typeOfEmployment") or {}).get("label"),
                    },
                )
            )
        if len(content) < PAGE:
            break
    return jobs


async def enrich(job: RawJob, http: Fetcher) -> RawJob:
    if not job.raw.get("detail"):
        return job
    response = await http.get(job.raw["detail"])
    if response.status_code == 200:
        sections = (response.json().get("jobAd") or {}).get("sections") or {}
        job.description = html_to_text(" ".join((s or {}).get("text", "") for s in sections.values()))
    return job
