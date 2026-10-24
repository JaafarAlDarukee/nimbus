"""Career-site sitemaps. `ref` is `<sitemap url>|<text every job URL contains>`, for example
`https://jobsearch.baesystems.com/sitemap.xml|/job/`. Titles come from the URL slug; the full
title and description are read later only for shortlisted jobs. A board whose notes say "UK only"
(Kier, Laing O'Rourke...) has its jobs counted as UK ones unless the link names somewhere else."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urlsplit

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob, Skipped
from ..text import html_to_text, parse_iso

MAX_CHILD_SITEMAPS = 20
_UUID = re.compile(r"[-_][0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
_TRAILING_ID = re.compile(r"[-_]\d{4,}$")
_COUNTRY_TAIL = re.compile(r"(?:^|[-_])(united[-_]kingdom|uk|gb|england|scotland|wales|northern[-_]ireland|ireland)$", re.I)
_TITLE_TAG = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
_META_DESC = re.compile(r'<meta[^>]+name="description"[^>]+content="([^"]*)"', re.I)


def _title_from_url(url: str, marker: str) -> tuple[str, str]:
    """Pull a readable title (and location, if present) out of a job URL."""
    path = unquote(urlsplit(url).path)
    tail = path.split(marker, 1)[-1]
    parts = [p for p in tail.split("/") if p and not p.isdigit()]
    country = ""
    if parts:  # "2027-civil-engineering-industry-placement-united-kingdom-21ef9145-..." -> title, "United Kingdom"
        last = _TRAILING_ID.sub("", _UUID.sub("", parts[-1]))
        if found := _COUNTRY_TAIL.search(last):
            country, last = found.group(1), last[: found.start()]
        parts[-1] = last
    words = [w for w in (re.sub(r"[-_]+", " ", p).strip() for p in parts) if w]
    if len(words) >= 2:
        return words[-1].title(), words[0].title()
    title = words[0].title() if words else path
    return title, re.sub(r"[-_]+", " ", country).title()


def _local(tag: str) -> str:
    """'{http://www.sitemaps.org/schemas/sitemap/0.9}url' -> 'url' (some sites use another namespace, or none)."""
    return tag.rsplit("}", 1)[-1]


def _child(element: ET.Element, name: str) -> str | None:
    return next((c.text for c in element if _local(c.tag) == name), None)


async def _urls(http: Fetcher, url: str, depth: int = 0) -> list[tuple[str, str | None]]:
    response = await http.get(url)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    if _local(root.tag) == "sitemapindex" and depth == 0:
        children = [(_child(e, "loc") or "").strip() for e in root.iter() if _local(e.tag) == "sitemap"]
        # Prefer child sitemaps that look like job lists
        jobby = [c for c in children if "job" in c.lower()]
        found = []
        for loc in (jobby or children)[:MAX_CHILD_SITEMAPS]:
            try:
                found.extend(await _urls(http, loc, depth + 1))
            except Exception:
                continue  # one blocked or broken child sitemap shouldn't sink the rest
        return found
    return [((_child(e, "loc") or "").strip(), _child(e, "lastmod")) for e in root.iter() if _local(e.tag) == "url"]


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    if tier == "priority" and board.tier != "priority":
        raise Skipped("a whole site's job list: every 6 hours, unless the board is marked priority")
    sitemap_url, _, marker = board.ref.partition("|")
    marker = marker or "/job"
    uk_only = bool(re.search(r"\bUK only\b", board.notes or "", re.I))
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
                country=guess_country(location) or ("GB" if uk_only else None),
                posted_at=parse_iso(lastmod),
            )
        )
    return jobs


def _words(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def best_title(page_title: str, slug_title: str) -> str:
    """The part of a job page's <title> that names the role: "Kier Careers | Site Engineer Placement"
    or "Site Engineer Placement - Kier" -> "Site Engineer Placement". Keeps the URL's title when no
    part of the page title shares its words (a page titled just "Careers")."""
    parts = [p.strip() for p in re.split(r"\s*\|\s*|\s+[-–—]\s+", page_title) if p.strip()]
    slug = _words(slug_title)
    best = max(parts, key=lambda p: len(slug & _words(p)), default="")
    if not best or not slug & _words(best):
        return slug_title
    return re.sub(r"\s+job details$", "", best, flags=re.I).strip() or slug_title


async def enrich(job: RawJob, http: Fetcher) -> RawJob:
    response = await http.get(job.url)
    if response.status_code != 200:
        return job
    page = response.text
    title = _TITLE_TAG.search(page)
    if title:
        job.title = best_title(html_to_text(title.group(1)), job.title)
    description = _META_DESC.search(page)
    body = html_to_text(page)
    job.description = (html_to_text(description.group(1)) + " " if description else "") + body[:4000]
    return job
