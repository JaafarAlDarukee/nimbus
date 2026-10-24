"""Careers pages with no hiring system Nimbus can read (owner, 24 Oct: placements "hidden in the
company website"). `ref` is the page's URL. Every link on the page whose text looks like a student
role (placement, internship, year in industry, graduate...) becomes a job; a new link on a later
check is a new role. A page's first check is silent, like any new board. Only pages robots.txt
allows are read. Assumed to be UK roles unless the text says otherwise.

Added by hand (data/discovered/research.csv) or from Telegram (/watchpage <link>), which stores the
page in the sources table."""

from __future__ import annotations

import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

from ..http import USER_AGENT, Fetcher
from ..models import Board, RawJob, Skipped
from ..text import html_to_text

STUDENT_LINK = re.compile(
    r"\b(placements?|industrial|year in industry|internships?|interns?|undergraduate|graduate|apprentice\w*|"
    r"summer (scheme|programme|internship)|spring (week|insight)|insight (day|week|programme)|early careers?|student)\b",
    re.I,
)
GENERIC_TEXT = re.compile(
    r"^(view( job| details| all| more)?|apply( now| here)?|see (more|all|jobs?)|more jobs|find out more|read more|learn more|"
    r"click here|here|details|search( jobs)?|(all )?vacancies|jobs|careers|early careers|students?( and graduates)?|graduates?)$",
    re.I,
)
# A real role names its subject or year ("Industrial Placement 2027 - Mechanical"); a menu link
# ("Placements", "Graduate opportunities") doesn't, unless its link points at a numbered job
ROLE_HINT = re.compile(
    r"\b(20\d\d|engineer\w*|technician|scientist|analyst|designer|developer|manufactur\w*|mechanical|electrical|electronic\w*|"
    r"civil|chemical|aerospace|automotive|structural|quality|production|process|project|operations|maintenance|design|"
    r"research|test\w*|systems?|controls?|robotics|materials|energy|nuclear|commercial|supply chain|procurement|software|data)\b",
    re.I,
)
_robots: dict[str, RobotFileParser | None] = {}


class _Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join(" ".join(self._text).split())))
            self._href = None


def student_links(html: str, base: str) -> list[tuple[str, str]]:
    """(absolute URL, link text) for links that look like a student role, once each."""
    parser = _Links()
    parser.feed(html)
    seen: dict[str, str] = {}
    for href, text in parser.links:
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        text = html_to_text(text)[:160]
        if len(text) < 8 or GENERIC_TEXT.match(text) or not STUDENT_LINK.search(text):
            continue
        url = urljoin(base, href).split("#")[0]
        if not ROLE_HINT.search(text) and not re.search(r"\d{4,}", urlsplit(url).path):
            continue
        seen.setdefault(url, text)
    return list(seen.items())


async def _allowed(http: Fetcher, url: str) -> bool:
    parts = urlsplit(url)
    host = f"{parts.scheme}://{parts.netloc}"
    if host not in _robots:
        try:
            response = await http.get(f"{host}/robots.txt")
            parser = RobotFileParser()
            parser.parse(response.text.splitlines() if response.status_code == 200 else [])
            _robots[host] = parser if response.status_code < 500 else None
        except Exception:
            _robots[host] = None
    parser = _robots[host]
    return parser is not None and parser.can_fetch(USER_AGENT, url)


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    if tier == "priority" and board.tier != "priority":
        raise Skipped("hand-added pages: every 6 hours; watched ones (priority) every run")
    if not await _allowed(http, board.ref):
        raise PermissionError("robots.txt doesn't allow reading this page")
    response = await http.get(board.ref)
    response.raise_for_status()
    return [
        RawJob(company=board.company, title=text, url=url, source_kind="page", location="", country="GB", raw={"page": board.ref})
        for url, text in student_links(response.text, str(response.url))
    ]
