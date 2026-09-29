"""Greenhouse job boards, e.g. slug `rendezvousrobotics` -> job-boards.greenhouse.io/rendezvousrobotics

Jobs are listed without descriptions (small and fast); descriptions are fetched only for
shortlisted jobs."""

from __future__ import annotations

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

HOSTS = ("https://boards-api.greenhouse.io",)


async def list_jobs(http: Fetcher, slug: str) -> tuple[str, list[dict]] | None:
    """(API host, jobs) for a board, or None if the board doesn't exist."""
    for host in HOSTS:
        response = await http.get(f"{host}/v1/boards/{slug}/jobs")
        if response.status_code == 404:
            continue
        response.raise_for_status()
        return host, response.json().get("jobs", [])
    return None


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    found = await list_jobs(http, board.ref)
    if found is None:
        raise LookupError(f"Greenhouse board '{board.ref}' not found")
    host, postings = found
    jobs = []
    for job in postings:
        location = (job.get("location") or {}).get("name", "")
        jobs.append(
            RawJob(
                company=board.company,
                title=job.get("title", "").strip(),
                url=job.get("absolute_url", ""),
                source_kind="greenhouse",
                location=location,
                country=guess_country(location),
                posted_at=parse_iso(job.get("first_published") or job.get("updated_at")),
                raw={"detail": f"{host}/v1/boards/{board.ref}/jobs/{job.get('id')}"},
            )
        )
    return jobs


async def enrich(job: RawJob, http: Fetcher) -> RawJob:
    response = await http.get(job.raw["detail"])
    if response.status_code == 200:
        job.description = html_to_text(response.json().get("content"))
    return job
