"""Discover boards on Greenhouse, Lever, Ashby, SmartRecruiters and Workable that have UK jobs.

    python -m radar.discover.ats                      # all five, writes data/discovered/<kind>.csv
    python -m radar.discover.ats greenhouse lever     # just some

Same approach as Workday discovery: Common Crawl lists the boards, one small request per board
counts its UK jobs, and boards with UK jobs are kept (minus the exclusion list). Meant for
GitHub Actions (weekly); it makes tens of thousands of requests."""

from __future__ import annotations

import asyncio
import csv
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from ..geo import country_code, guess_country
from ..http import Fetcher
from ..pipeline.exclusions import excluded_company
from ..pipeline.names import clean_company_name
from ..sources.greenhouse import list_jobs as greenhouse_jobs
from .commoncrawl import urls

ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "data" / "discovered"

PATTERNS = {
    "greenhouse": ["boards.greenhouse.io/*", "job-boards.greenhouse.io/*", "job-boards.eu.greenhouse.io/*"],
    "lever": ["jobs.lever.co/*", "jobs.eu.lever.co/*"],
    "ashby": ["jobs.ashbyhq.com/*"],
    "smartrecruiters": ["jobs.smartrecruiters.com/*", "careers.smartrecruiters.com/*"],
    "workable": ["apply.workable.com/*"],
}
NOT_SLUGS = {
    "embed", "api", "j", "static", "favicon.ico", "robots.txt", "sitemap.xml", "v1", "oneclick-ui",
    "candidate", "jobs", "search", "widget", "careers", "login", "privacy", "cookie-policy", "terms",
    "assets", "includes", "job_board", "js", "css", "images", "app",
}
SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{1,80}$")
MAX_CONCURRENT = 24


def slug_from(url: str) -> str | None:
    parts = urlsplit(url)
    if "for" in parse_qs(parts.query):  # boards.greenhouse.io/embed/job_board?for=acme
        slug = parse_qs(parts.query)["for"][0]
    else:
        segments = [s for s in parts.path.split("/") if s]
        slug = segments[0] if segments else ""
    return slug if SLUG.match(slug) and slug.lower() not in NOT_SLUGS else None


def board_slugs(kind: str) -> list[str]:
    slugs: dict[str, str] = {}
    for pattern in PATTERNS[kind]:
        for url in urls(pattern):
            slug = slug_from(url)
            if slug:
                slugs.setdefault(slug.lower(), slug)
    return sorted(slugs.values(), key=str.lower)


def _is_uk(location: str | None, country: str | None = None) -> bool:
    return (country_code(country) if country else None) == "GB" or guess_country(location or "") == "GB"


def _name_from_slug(slug: str) -> str:
    return re.sub(r"[-_.]+", " ", slug).strip().title()


async def _greenhouse(http: Fetcher, slug: str) -> tuple[str, int, int] | None:
    found = await greenhouse_jobs(http, slug)
    if not found:
        return None
    host, jobs = found
    uk = sum(_is_uk((j.get("location") or {}).get("name")) for j in jobs)
    name = _name_from_slug(slug)
    if uk:
        info = await http.get(f"{host}/v1/boards/{slug}")
        if info.status_code == 200:
            name = info.json().get("name") or name
    return name, uk, len(jobs)


async def _lever(http: Fetcher, slug: str) -> tuple[str, int, int] | None:
    for host in ("https://api.lever.co", "https://api.eu.lever.co"):
        response = await http.get(f"{host}/v0/postings/{slug}?mode=json")
        if response.status_code == 200:
            jobs = response.json()
            uk = sum(_is_uk((j.get("categories") or {}).get("location"), j.get("country")) for j in jobs)
            return _name_from_slug(slug), uk, len(jobs)
    return None


async def _ashby(http: Fetcher, slug: str) -> tuple[str, int, int] | None:
    response = await http.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=false")
    if response.status_code != 200:
        return None
    jobs = response.json().get("jobs", [])
    uk = sum(
        _is_uk(j.get("location"), ((j.get("address") or {}).get("postalAddress") or {}).get("addressCountry"))
        for j in jobs
    )
    return _name_from_slug(slug), uk, len(jobs)


async def _smartrecruiters(http: Fetcher, slug: str) -> tuple[str, int, int] | None:
    # The API filters by country itself (lowercase ISO code), so big boards are counted exactly
    url = f"https://api.smartrecruiters.com/v1/companies/{slug}/postings"
    uk = await http.get(url, params={"limit": 1, "country": "gb"})
    if uk.status_code != 200:
        return None
    uk_data = uk.json()
    if not uk_data.get("totalFound"):
        return None
    name = ((uk_data["content"][0].get("company") or {}).get("name")) or _name_from_slug(slug)
    everything = await http.get(url, params={"limit": 1})
    total = everything.json().get("totalFound", "?") if everything.status_code == 200 else "?"
    return name, uk_data["totalFound"], total


async def _workable(http: Fetcher, slug: str) -> tuple[str, int, int] | None:
    response = await http.get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
    if response.status_code != 200:
        return None
    data = response.json()
    jobs = data.get("jobs", [])
    uk = sum(_is_uk(j.get("city"), j.get("country_code") or j.get("country")) for j in jobs)
    return data.get("name") or _name_from_slug(slug), uk, len(jobs)


PROBES = {
    "greenhouse": _greenhouse, "lever": _lever, "ashby": _ashby,
    "smartrecruiters": _smartrecruiters, "workable": _workable,
}


async def _probe(kind: str, slug: str, http: Fetcher, limit: asyncio.Semaphore) -> dict | None:
    async with limit:
        try:
            result = await PROBES[kind](http, slug)
        except Exception:
            return None
    if not result:
        return None
    name, uk, total = result
    name = clean_company_name(name)
    if not uk or excluded_company(name):
        return None
    return {"company": name, "kind": kind, "ref": slug, "tier": "standard",
            "notes": f"auto: {uk} UK jobs of {total} when discovered"}


async def discover(kind: str) -> list[dict]:
    slugs = board_slugs(kind)
    print(f"{kind}: probing {len(slugs)} boards for UK jobs")
    http = Fetcher(per_host=MAX_CONCURRENT, total=MAX_CONCURRENT)
    limit = asyncio.Semaphore(MAX_CONCURRENT)
    try:
        results = await asyncio.gather(*(_probe(kind, s, http, limit) for s in slugs))
    finally:
        await http.aclose()
    return sorted((r for r in results if r), key=lambda r: r["company"].lower())


def main() -> None:
    kinds = sys.argv[1:] or list(PATTERNS)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for kind in kinds:
        boards = asyncio.run(discover(kind))
        with (OUTPUT_DIR / f"{kind}.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=["company", "kind", "ref", "tier", "notes"])
            writer.writeheader()
            writer.writerows(boards)
        print(f"{kind}: saved {len(boards)} boards with UK jobs")


if __name__ == "__main__":
    main()
