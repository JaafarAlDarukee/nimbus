"""Entry-level roles from NHS Jobs (www.jobs.nhs.uk): the public search results, 10 per page. Its
robots.txt sets no rules. Searches student and graduate words only; the classifier then keeps the
roles that are really for students and graduates (trainees, apprentices, graduate posts, research).

`ref` is unused (`nhs`)."""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Board, RawJob

SEARCH = "https://www.jobs.nhs.uk/candidate/search/results"
KEYWORDS = [
    "graduate", "trainee", "apprentice", "student", "placement", "healthcare science", "biomedical scientist",
    "clinical scientist", "assistant psychologist", "research assistant", "preceptorship",
]
PAGES = {"priority": 1, "full": 3}
# NHS entry-level titles the general rules don't recognise as early-career on their own
ENTRY_LEVEL = re.compile(r"\b(trainee|graduates?|newly qualified|preceptorship|assistant psychologist|student)\b", re.I)


def _text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def _date(block: str, test: str) -> datetime | None:
    match = re.search(rf'data-test="{test}"[^>]*>.*?<strong[^>]*>(.*?)</strong>', block, re.S)
    if not match:
        return None
    try:
        return datetime.strptime(_text(match.group(1)), "%d %B %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def jobs_from(page: str) -> list[RawJob]:
    jobs = []
    for block in page.split('data-test="search-result"')[1:]:
        block = block[:5000]
        link = re.search(r'href="/candidate/jobadvert/([^"?]+)[^"]*"[^>]*data-test="search-result-job-title"[^>]*>(.*?)</a>', block, re.S)
        if not link:
            continue
        ref, title = link.group(1), _text(link.group(2))
        where = re.search(r'data-test="search-result-location".*?<h3[^>]*>(.*?)<div[^>]*location-font-size[^>]*>(.*?)</div>', block, re.S)
        employer = _text(where.group(1)) if where else "NHS"
        place = _text(where.group(2)) if where else ""
        jobs.append(
            RawJob(
                company=employer,
                title=title,
                url=f"https://www.jobs.nhs.uk/candidate/jobadvert/{ref}",
                source_kind="nhsjobs",
                location=place,
                country="GB",
                description=f"NHS Jobs advert {ref}. {title} at {employer}, {place}.",
                posted_at=_date(block, "search-result-publicationDate"),
                closes_at=_date(block, "search-result-closingDate"),
                raw={"employment": "graduate"} if ENTRY_LEVEL.search(title) else {},
            )
        )
    return jobs


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    found: dict[str, RawJob] = {}
    for keyword in KEYWORDS:
        for page in range(1, PAGES.get(tier, 1) + 1):
            response = await http.get(SEARCH, params={"keyword": keyword, "language": "en", "page": page})
            response.raise_for_status()
            batch = jobs_from(response.text)
            for job in batch:
                found.setdefault(job.url, job)
            if len(batch) < 10:
                break
    return list(found.values())
