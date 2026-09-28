"""Lever job boards, e.g. slug `acme` -> jobs.lever.co/acme (EU-hosted boards use api.eu.lever.co)"""

from __future__ import annotations

from ..geo import country_code, guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import from_millis

HOSTS = ("https://api.lever.co", "https://api.eu.lever.co")


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    response = None
    for host in HOSTS:
        response = await http.get(f"{host}/v0/postings/{board.ref}?mode=json")
        if response.status_code != 404:
            break
    response.raise_for_status()

    jobs = []
    for posting in response.json():
        categories = posting.get("categories") or {}
        location = categories.get("location") or ", ".join(categories.get("allLocations") or [])
        jobs.append(
            RawJob(
                company=board.company,
                title=posting.get("text", "").strip(),
                url=posting.get("hostedUrl", ""),
                source_kind="lever",
                location=location,
                country=country_code(posting.get("country")) or guess_country(location),
                description=posting.get("descriptionPlain") or "",
                posted_at=from_millis(posting.get("createdAt")),
                remote=posting.get("workplaceType") == "remote" or None,
                raw={"commitment": categories.get("commitment")},
            )
        )
    return jobs
