"""Workday career sites, e.g. https://rollsroyce.wd3.myworkdayjobs.com/professional

Uses the same JSON endpoints the career site itself calls. Jobs are listed per country using the
site's Country filter, so every job gets a country without extra requests. The priority tier only
lists UK and Ireland; the full tier lists every country (non-UK early-careers roles feed the
global-mobility tag)."""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from ..geo import country_code
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

PAGE = 20
PRIORITY_COUNTRIES = {"GB", "IE"}
MAX_PAGES_PER_COUNTRY = 60

_POSTED = re.compile(r"(\d+)\+?\s+days?\s+ago", re.I)


def _site(ref: str) -> tuple[str, str, str]:
    parts = urlsplit(ref)
    host = parts.hostname or ""
    tenant = host.split(".")[0]
    segments = [s for s in parts.path.split("/") if s]
    # Skip an optional locale such as en-US
    if segments and re.fullmatch(r"[a-z]{2}-[A-Z]{2}", segments[0]):
        segments = segments[1:]
    return host, tenant, segments[0]


def _posted_at(text: str | None) -> datetime | None:
    if not text:
        return None
    now = datetime.now(timezone.utc)
    lowered = text.lower()
    if "today" in lowered:
        return now
    if "yesterday" in lowered:
        return now - timedelta(days=1)
    match = _POSTED.search(lowered)
    if match and "+" not in lowered:
        return now - timedelta(days=int(match.group(1)))
    return None


def _find_country_facet(facets: list[dict]) -> dict | None:
    """The Country filter is sometimes top level, sometimes nested inside a location group."""
    for facet in facets:
        if "country" in (facet.get("facetParameter") or "").lower():
            return facet
        nested = _find_country_facet([v for v in facet.get("values", []) if v.get("facetParameter")])
        if nested:
            return nested
    return None


async def _list(http: Fetcher, api: str, facets: dict) -> list[dict]:
    postings: list[dict] = []
    for page in range(MAX_PAGES_PER_COUNTRY):
        response = await http.post(
            api, json={"appliedFacets": facets, "limit": PAGE, "offset": page * PAGE, "searchText": ""}
        )
        response.raise_for_status()
        batch = response.json().get("jobPostings", [])
        postings.extend(batch)
        if len(batch) < PAGE:
            break
    return postings


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    host, tenant, site = _site(board.ref)
    api = f"https://{host}/wday/cxs/{tenant}/{site}/jobs"

    first = await http.post(api, json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""})
    first.raise_for_status()
    country_facet = _find_country_facet(first.json().get("facets", []))

    groups: list[tuple[str | None, dict]] = []
    if country_facet:
        for value in country_facet.get("values", []):
            code = country_code(value.get("descriptor")) or value.get("descriptor")
            if tier == "priority" and code not in PRIORITY_COUNTRIES:
                continue
            groups.append((code, {country_facet["facetParameter"]: [value["id"]]}))
    else:
        groups.append((None, {}))

    # Countries are listed side by side; the shared Fetcher still caps requests per host
    listings = await asyncio.gather(*(_list(http, api, facets) for _, facets in groups))
    jobs: list[RawJob] = []
    for (code, _), postings in zip(groups, listings):
        for posting in postings:
            path = posting.get("externalPath", "")
            jobs.append(
                RawJob(
                    company=board.company,
                    title=posting.get("title", "").strip(),
                    url=f"https://{host}/{site}{path}",
                    source_kind="workday",
                    location=posting.get("locationsText", ""),
                    country=code,
                    posted_at=_posted_at(posting.get("postedOn")),
                    raw={"api": api, "path": path},
                )
            )
    return jobs


async def enrich(job: RawJob, http: Fetcher) -> RawJob:
    response = await http.get(job.raw["api"].removesuffix("/jobs") + job.raw["path"])
    if response.status_code != 200:
        return job
    info = response.json().get("jobPostingInfo", {})
    job.description = html_to_text(info.get("jobDescription"))
    job.location = info.get("location") or job.location
    job.country = country_code((info.get("country") or {}).get("descriptor")) or job.country
    job.posted_at = parse_iso(info.get("startDate")) or job.posted_at
    job.url = info.get("externalUrl") or job.url
    return job
