"""Discover Workday career sites that have UK jobs.

    python -m radar.discover.workday            # writes data/discovered/workday.csv

1. Common Crawl lists every *.myworkdayjobs.com site it has seen.
2. Each site is asked (one small request) for its jobs-by-country counts.
3. Sites with UK jobs get their real employer name from one UK job, are checked against the
   exclusion list, and are saved as boards for the radar.

Meant to run on GitHub Actions (weekly), not a home PC: it makes a few thousand requests."""

from __future__ import annotations

import asyncio
import csv
import re
from pathlib import Path

from ..http import Fetcher
from ..pipeline.exclusions import excluded_company
from ..pipeline.names import clean_company_name
from ..sources.workday import _find_country_facet
from .commoncrawl import urls

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "discovered" / "workday.csv"
SITE_URL = re.compile(
    r"https?://([a-z0-9-]+\.wd\d+\.myworkdayjobs\.com)(?::\d+)?/(?:[a-z]{2}-[A-Z]{2}/)?([A-Za-z0-9_-]+)", re.I
)
NOT_SITES = {"wday", "robots.txt", "favicon.ico", "sitemap.xml"}
UK_NAMES = {"united kingdom", "uk", "great britain", "england", "scotland", "wales", "northern ireland"}
MAX_CONCURRENT = 12


def workday_sites() -> list[tuple[str, str]]:
    sites = set()
    for url in urls("*.myworkdayjobs.com"):
        match = SITE_URL.match(url)
        if match and match.group(2).lower() not in NOT_SITES:
            sites.add((match.group(1).lower(), match.group(2)))
    return sorted(sites)


async def probe(http: Fetcher, host: str, site: str, limit: asyncio.Semaphore) -> dict | None:
    tenant = host.split(".")[0]
    api = f"https://{host}/wday/cxs/{tenant}/{site}/jobs"
    async with limit:
        try:
            first = await http.post(api, json={"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""})
            if first.status_code != 200:
                return None
            facet = _find_country_facet(first.json().get("facets", []))
            if not facet:
                return None
            uk = next((v for v in facet.get("values", []) if (v.get("descriptor") or "").lower() in UK_NAMES), None)
            if not uk or not uk.get("count"):
                return None

            one = await http.post(
                api, json={"appliedFacets": {facet["facetParameter"]: [uk["id"]]}, "limit": 1, "offset": 0, "searchText": ""}
            )
            postings = one.json().get("jobPostings", []) if one.status_code == 200 else []
            name = tenant
            if postings:
                detail = await http.get(api.removesuffix("/jobs") + postings[0]["externalPath"])
                if detail.status_code == 200:
                    name = ((detail.json().get("hiringOrganization") or {}).get("name") or tenant).strip()
        except Exception:
            return None

    name = clean_company_name(name)
    if excluded_company(name):
        return None
    return {
        "company": name,
        "kind": "workday",
        "ref": f"https://{host}/{site}",
        "tier": "standard",
        "notes": f"auto: {uk['count']} UK jobs of {first.json().get('total', '?')} when discovered",
    }


async def discover() -> list[dict]:
    sites = workday_sites()
    print(f"Probing {len(sites)} Workday sites for UK jobs")
    http = Fetcher(per_host=2)
    limit = asyncio.Semaphore(MAX_CONCURRENT)
    try:
        results = await asyncio.gather(*(probe(http, host, site, limit) for host, site in sites))
    finally:
        await http.aclose()
    return sorted((r for r in results if r), key=lambda r: r["company"].lower())


def main() -> None:
    boards = asyncio.run(discover())
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["company", "kind", "ref", "tier", "notes"])
        writer.writeheader()
        writer.writerows(boards)
    print(f"Saved {len(boards)} Workday boards with UK jobs to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
