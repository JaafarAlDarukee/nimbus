"""Student hackathons from Major League Hacking's season page (www.mlh.com/seasons/<year>/events;
robots.txt allows it). Each event card carries schema.org Event data: name, dates, place, country,
online or in person, and the hackathon's own website.

`ref` is unused (`hackathons`). Keeps in-person hackathons in the UK, Europe, North America and the Middle
East (MLH's online weeks are software-only). They go to engineering degrees.
MLH seasons run August to July and are named after the year they end in."""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Board, RawJob
from .event_tags import ENGINEERING_ONLY, REGIONS, engineering_tags

EVENT = re.compile(r'itemType="https://schema.org/Event"')


def _seasons(now: datetime) -> list[int]:
    season = now.year + 1 if now.month >= 8 else now.year
    # From May the next season's page starts filling up
    return [season, season + 1] if now.month in (5, 6, 7) else [season]


def _prop(block: str, name: str) -> str:
    match = re.search(rf'itemProp="{name}" content="([^"]*)"', block)
    return html.unescape(match.group(1)) if match else ""


def _date(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None
    except ValueError:
        return None


def events_from(page: str) -> list[RawJob]:
    jobs: list[RawJob] = []
    for block in EVENT.split(page)[1:]:
        block = block[:6000]
        name = re.search(r'alt="([^"]+?) (?:background|logo)"', block)
        url = _prop(block, "url")
        if not name or not url:
            continue
        online = _prop(block, "eventAttendanceMode").endswith("OnlineEventAttendanceMode")
        country = _prop(block, "addressCountry") or None
        if online or country not in REGIONS:
            continue
        place = ", ".join(dict.fromkeys(p for p in (_prop(block, "addressLocality"), _prop(block, "addressRegion")) if p))
        starts, ends = _date(_prop(block, "startDate")), _date(_prop(block, "endDate"))
        title = html.unescape(name.group(1)).strip()
        if "hack" not in title.lower():
            title = f"{title} (hackathon)"
        when = f"{starts:%d %b %Y}" + (f" to {ends:%d %b %Y}" if ends and ends.date() != starts.date() else "") if starts else ""
        jobs.append(
            RawJob(
                company="Major League Hacking",
                title=title,
                url=url,
                source_kind="mlh",
                location="Online" if online else place,
                country=None if online else country,
                remote=online,
                description=" · ".join(p for p in (
                    "Student hackathon in the MLH season", f"Dates: {when}" if when else "",
                    "Free to attend" if _prop(block, "isAccessibleForFree") == "true" else "",
                ) if p),
                posted_at=None,
                closes_at=ends or starts,
                raw={"employment": "hackathon", "disciplines": engineering_tags(title) or ENGINEERING_ONLY + ["software"]},
            )
        )
    return jobs


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    now = datetime.now(timezone.utc)
    jobs: list[RawJob] = []
    for season in _seasons(now):
        response = await http.get(f"https://www.mlh.com/seasons/{season}/events")
        if response.status_code == 404:
            continue
        response.raise_for_status()
        jobs += [j for j in events_from(response.text) if not j.closes_at or j.closes_at >= now]
    return jobs
