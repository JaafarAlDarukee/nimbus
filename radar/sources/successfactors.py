"""SAP SuccessFactors career sites, e.g. https://www.jaguarlandrovercareers.com

Their RSS feed only returns ~20 items per request, so we ask it once per early-careers keyword
(plus once with no keyword for the newest jobs). Titles look like 'Welding Engineer (Wolverhampton, GB)'."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from ..geo import country_code
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text

KEYWORDS = ["", "placement", "intern", "internship", "graduate", "undergraduate", "apprentice",
            "student", "industrial", "insight", "year in industry"]
_TITLE = re.compile(r"^(.*?)\s*\(([^()]*)\)\s*$")
_DATE_FIELD = r"{}\s*:?\s*(\d{{1,2}})/(\d{{1,2}})/(\d{{4}})"


def _field_date(text: str, label: str) -> datetime | None:
    match = re.search(_DATE_FIELD.format(label), text, re.I)
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    try:
        return datetime(year, month, day, tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse(board: Board, content: bytes) -> list[RawJob]:
    jobs = []
    for item in ET.fromstring(content).iter("item"):
        full_title = (item.findtext("title") or "").strip()
        match = _TITLE.match(full_title)
        title, location = (match.group(1), match.group(2)) if match else (full_title, "")
        country = None
        if location and "," in location:
            country = country_code(location.rsplit(",", 1)[1].strip())
        description = html_to_text(item.findtext("description"))
        posted = _field_date(description, "posting start date")
        if posted is None and item.findtext("pubDate"):
            try:
                posted = parsedate_to_datetime(item.findtext("pubDate"))
            except (TypeError, ValueError):
                posted = None
        jobs.append(
            RawJob(
                company=board.company,
                title=title,
                url=(item.findtext("link") or "").strip(),
                source_kind="successfactors",
                location=location,
                country=country,
                description=description,
                posted_at=posted,
                closes_at=_field_date(description, "posting end date"),
            )
        )
    return jobs


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    feed = board.ref.rstrip("/") + "/services/rss/job/"
    seen: dict[str, RawJob] = {}
    for keyword in KEYWORDS:
        params = {"locale": "en_GB"}
        if keyword:
            params["keywords"] = keyword
        response = await http.get(feed, params=params)
        response.raise_for_status()
        for job in _parse(board, response.content):
            seen.setdefault(job.url, job)
    return list(seen.values())
