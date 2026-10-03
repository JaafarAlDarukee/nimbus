"""Hackathons from Devpost's public listing (devpost.com/api/hackathons; robots.txt allows it).

`ref` is unused (`hackathons`). Keeps engineering and science hackathons (hardware, robotics, energy,
space, medtech...; see event_tags.py) that are online or in the UK, Europe, North America or the Middle East.
Each becomes an event ("hackathon" hint) for the degrees it suits, closing when submissions close."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from ..geo import guess_country
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text
from .event_tags import REGIONS, engineering_tags

PAGES = {"priority": 2, "full": 8}


def _end_date(dates: str) -> datetime | None:
    """'Aug 31 - Oct 23, 2026' or 'Oct 04 - 05, 2026' -> the closing day."""
    match = re.search(r"(?:([A-Z][a-z]{2}) )?(\d{1,2}), (\d{4})\s*$", dates or "")
    if not match:
        return None
    month = match.group(1) or (re.match(r"([A-Z][a-z]{2})", dates or "") or [None, None])[1]
    try:
        return datetime.strptime(f"{match.group(2)} {month} {match.group(3)} 23:59", "%d %b %Y %H:%M").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    jobs: list[RawJob] = []
    for page in range(1, PAGES.get(tier, 2) + 1):
        response = await http.get("https://devpost.com/api/hackathons", params={"status[]": ["upcoming", "open"], "page": page})
        response.raise_for_status()
        hackathons = response.json().get("hackathons", [])
        for h in hackathons:
            where = (h.get("displayed_location") or {}).get("location") or ""
            online = where.strip().lower() == "online"
            country = None if online else guess_country(where)
            if not online and country not in REGIONS:
                continue
            title = html_to_text(h.get("title"))
            themes_text = " ".join(t.get("name", "") for t in h.get("themes") or [])
            tags = engineering_tags(f"{title} {themes_text}")
            if tags is None:  # AI-, web- or app-only: not for engineering and science students
                continue
            if "hackathon" not in title.lower():
                title = f"{title} (hackathon)"
            themes = ", ".join(t.get("name", "") for t in h.get("themes") or [])
            prize = html_to_text(h.get("prize_amount") or "")
            jobs.append(
                RawJob(
                    company=h.get("organization_name") or "Devpost",
                    title=title,
                    url=h.get("url", ""),
                    source_kind="devpost",
                    location="Online" if online else where,
                    country=country,
                    remote=online,
                    description=" · ".join(p for p in (f"Themes: {themes}" if themes else "", f"Prizes: {prize}" if prize else "",
                                                       f"Dates: {h.get('submission_period_dates', '')}") if p),
                    closes_at=_end_date(h.get("submission_period_dates", "")),
                    raw={"employment": "hackathon", "disciplines": tags, "registrations": h.get("registrations_count")},
                )
            )
        if len(hackathons) < 9:
            break
    return jobs
