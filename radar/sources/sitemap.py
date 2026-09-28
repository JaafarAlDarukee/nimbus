"""Career-site sitemaps. `ref` is `<sitemap url>|<text every job URL contains>`, for example
`https://jobsearch.baesystems.com/sitemap.xml|/job/`. Titles come from the URL slug; the full
title and description are read later only for shortlisted jobs."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlsplit

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
MAX_CHILD_SITEMAPS = 20
_TITLE_TAG = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
_META_DESC = re.compile(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', re.I)


def _title_from_url(url: str, marker: str) -> tuple[str, str]:
    """Pull a readable title (and location, if present) out of a job URL."""
    path = unquote(urlsplit(url).path)
    tail = path.split(marker, 1)[-1]
    parts = [p for p in tail.split("/") if p and not p.isdigit()]
    words = [re.sub(r"[-_]+", " ", p).strip() for p in parts]
    if len(words) >= 2:
        return words[-1].title(), words[0].title()
    return (words[0].title() if words else path), ""


async def _urls(http: Fetcher, url: str, depth: int = 0) -> list[tuple[str, str | None]]:
    response = await http.get(url)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    if root.tag == f"{NS}sitemapindex" and depth == 0:
        children = [(e.findtext(f"{NS}loc") or "").strip() for e in root.iter(f"{NS}sitemap")]
        # Prefer child sitemaps that look like job lists
        jobby = [c for c in children if "job" in c.lower()]
        found = []
        for loc in (jobby or children)[:MAX_CHILD_SITEMAPS]:
            try:
                found.extend(await _urls(http, loc, depth + 1))
            except Exception:
                continue  # one blocked or broken child sitemap shouldn't sink the rest
        return found
    return [
        ((e.findtext(f"{NS}loc") or "").strip(), e.findtext(f"{NS}lastmod"))
        for e in root.iter(f"{NS}url")
    ]


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    sitemap_url, _, marker = board.ref.partition("|")
    marker = marker or "/job"
    jobs = []
    for url, lastmod in await _urls(http, sitemap_url):
        if marker not in url:
            continue
        title, location = _title_from_url(url, marker)
        jobs.append(
            RawJob(
                company=board.company,
                title=title,
                url=url,
                source_kind="sitemap",
                location=location,
                country=guess_country(location),
                posted_at=parse_iso(lastmod),
            )
        )
    return jobs


async def enrich(job: RawJob, http: Fetcher) -> RawJob:
    response = await http.get(job.url)
    if response.status_code != 200:
        return job
    page = response.text
    title = _TITLE_TAG.search(page)
    if title:
        job.title = html_to_text(title.group(1)).split("|")[0].split(" - ")[0].strip() or job.title
    description = _META_DESC.search(page)
    body = html_to_text(page)
    job.description = (html_to_text(description.group(1)) + " " if description else "") + body[:4000]
    return job
