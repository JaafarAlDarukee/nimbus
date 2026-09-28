"""Adzuna job-search API (developer.adzuna.com). `ref` is the country code, e.g. `gb`.

One board covers thousands of employers, so the company comes from each result. The free plan
has daily limits, so each run makes at most a few requests: the newest early-careers ads first.
Adzuna's terms ask that listings shown to people credit "Jobs by Adzuna"."""

from __future__ import annotations

import os

from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

EARLY_CAREERS = "placement placements internship internships intern graduate graduates apprentice apprenticeship undergraduate"

# (Adzuna category, pages). The priority run stays within a couple of requests; the full run
# (every 4 hours) also covers neighbouring categories and one general early-careers sweep.
QUERIES = {
    "priority": [("engineering-jobs", 1), ("manufacturing-jobs", 1)],
    "full": [("engineering-jobs", 3), ("manufacturing-jobs", 1), ("scientific-qa-jobs", 1),
             ("energy-oil-gas-jobs", 1), ("graduate-jobs", 1), (None, 1)],
}


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    app_id, app_key = os.environ.get("ADZUNA_APP_ID"), os.environ.get("ADZUNA_APP_KEY")
    if not (app_id and app_key):
        return []

    country = board.ref.lower()
    jobs = []
    for category, pages in QUERIES.get(tier, QUERIES["priority"]):
        for page in range(1, pages + 1):
            params = {
                "app_id": app_id,
                "app_key": app_key,
                "what_or": EARLY_CAREERS,
                "max_days_old": 3,
                "sort_by": "date",
                "results_per_page": 50,
                "content-type": "application/json",
            }
            if category:
                params["category"] = category
            results = await _search(http, country, page, params)
            jobs.extend(_to_job(ad, country) for ad in results)
            if len(results) < 50:
                break
    return jobs


async def _search(http: Fetcher, country: str, page: int, params: dict) -> list[dict]:
    response = await http.get(f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}", params=params)
    if response.status_code == 400 and "category" in params:
        print(f"Adzuna: category {params['category']!r} not accepted for {country}; skipping it")
        return []
    response.raise_for_status()
    return response.json().get("results", [])


def _to_job(ad: dict, country: str) -> RawJob:
    location = (ad.get("location") or {}).get("display_name", "")
    return RawJob(
        company=((ad.get("company") or {}).get("display_name") or "Unknown employer").strip(),
        title=html_to_text(ad.get("title")),
        url=ad.get("redirect_url", ""),
        source_kind="adzuna",
        location=location,
        country=country.upper(),
        description=html_to_text(ad.get("description")),
        posted_at=parse_iso(ad.get("created")),
        raw={"adzuna_id": ad.get("id"), "category": (ad.get("category") or {}).get("label"),
             "employment": ad.get("contract_time")},
    )
