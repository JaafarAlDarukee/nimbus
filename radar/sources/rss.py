"""RSS / Atom job feeds (e.g. SAP SuccessFactors career sites, jobs.ac.uk). `ref` is the feed URL."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

ATOM = "{http://www.w3.org/2005/Atom}"


def _date(value: str | None):
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return parse_iso(value)


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    response = await http.get(board.ref)
    response.raise_for_status()
    root = ET.fromstring(response.content)
    jobs = []
    for item in root.iter("item"):
        description = html_to_text(item.findtext("description"))
        jobs.append(
            RawJob(
                company=board.company,
                title=(item.findtext("title") or "").strip(),
                url=(item.findtext("link") or "").strip(),
                source_kind="rss",
                description=description,
                country=guess_country(description[:300]),
                posted_at=_date(item.findtext("pubDate")),
            )
        )
    for entry in root.iter(f"{ATOM}entry"):
        link = entry.find(f"{ATOM}link")
        summary = html_to_text(entry.findtext(f"{ATOM}summary") or entry.findtext(f"{ATOM}content"))
        jobs.append(
            RawJob(
                company=board.company,
                title=(entry.findtext(f"{ATOM}title") or "").strip(),
                url=link.get("href", "") if link is not None else "",
                source_kind="rss",
                description=summary,
                country=guess_country(summary[:300]),
                posted_at=parse_iso(entry.findtext(f"{ATOM}published") or entry.findtext(f"{ATOM}updated")),
            )
        )
    return jobs
