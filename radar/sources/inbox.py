"""The Nimbus inbox: job-alert emails (Gradcracker, LinkedIn, RateMyPlacement, ...) sent or
forwarded to a dedicated Gmail, turned into opportunities.

    python -m radar.sources.inbox --inspect     # local only: show what's in recent alert emails

Reads the mailbox read-only (nothing is marked read, moved or deleted) with a Gmail app password
(GMAIL_ADDRESS / GMAIL_APP_PASSWORD). Links in the emails are never opened: alert emails also
contain unsubscribe links. Job links are cleaned of tracking codes before being stored."""

from __future__ import annotations

import asyncio
import email
import imaplib
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from urllib.parse import parse_qs, unquote, urlsplit, urlunsplit

from ..http import Fetcher
from ..models import Board, RawJob

DAYS_BACK = 3
MAX_EMAILS = 300


@dataclass
class Site:
    name: str
    senders: tuple[str, ...]  # sender domains
    job_link: re.Pattern      # what a link to one job looks like on this site
    uk_only: bool = True


SITES = [
    Site("Gradcracker", ("gradcracker.com",),
         re.compile(r"gradcracker\.com/hub/\d+/[^/?#\s]+/[^/?#\s]+/\d+/[^?#\s]+", re.I)),
    Site("LinkedIn", ("linkedin.com",), re.compile(r"linkedin\.com/(comm/)?jobs/view/\d+", re.I), uk_only=False),
    Site("RateMyPlacement", ("ratemyplacement.co.uk",), re.compile(r"ratemyplacement\.co\.uk/jobs/\d+", re.I)),
    Site("Bright Network", ("brightnetwork.co.uk",),
         re.compile(r"brightnetwork\.co\.uk/(graduate-jobs|internships|jobs|graduate-schemes)/[^?#\s]+", re.I)),
    Site("Handshake", ("joinhandshake.co.uk", "joinhandshake.com"),
         re.compile(r"joinhandshake\.(co\.uk|com)/(stu/)?(jobs|job-search)/\d+", re.I), uk_only=False),
    Site("TARGETjobs", ("targetjobs.co.uk",), re.compile(r"targetjobs\.co\.uk/[^?#\s]*\d{4,}", re.I)),
    Site("Prospects", ("prospects.ac.uk",), re.compile(r"prospects\.ac\.uk/[^?#\s]*(jobs|job)[^?#\s]*\d+", re.I)),
    Site("Indeed", ("indeed.com", "indeed.co.uk"), re.compile(r"indeed\.(com|co\.uk)/[^\s]*[?&]jk=[0-9a-f]+", re.I),
         uk_only=False),
]
GENERIC_TEXT = re.compile(
    r"^(view( job| details| all)?|apply( now)?|see (more|all|job)|more jobs|find out more|read more|"
    r"learn more|unsubscribe|manage (alerts|preferences)|click here|here|details)$",
    re.I,
)


class _Links(HTMLParser):
    """Collects (href, visible text) for every link in an HTML email."""

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
        if tag == "a" and self._href:
            self.links.append((self._href, re.sub(r"\s+", " ", " ".join(self._text)).strip()))
            self._href = None


def _embedded_urls(href: str) -> list[str]:
    """Tracking links often carry the real address inside a parameter (?url=https%3A...)."""
    candidates = [href]
    for values in parse_qs(urlsplit(href).query).values():
        candidates += [unquote(v) for v in values if "http" in unquote(v)]
    return candidates


def _canonical(url: str, site: Site) -> str:
    """Strip tracking parameters; Indeed keeps only its job id."""
    parts = urlsplit(url)
    if site.name == "Indeed":
        job_id = parse_qs(parts.query).get("jk", [""])[0]
        return f"https://uk.indeed.com/viewjob?jk={job_id}"
    return urlunsplit((parts.scheme or "https", parts.netloc, parts.path, "", ""))


def _company_from(url: str, site: Site) -> str | None:
    if site.name == "Gradcracker":  # /hub/<id>/<employer-slug>/<type>/<id>/<title-slug>
        segments = [s for s in urlsplit(url).path.split("/") if s]
        if len(segments) >= 3:
            slug = segments[2]
            return slug.upper() if len(slug) <= 3 else slug.replace("-", " ").title()  # jcb -> JCB
    return None


def _site_for(sender: str, links: list[tuple[str, str]]) -> Site | None:
    domain = sender.rsplit("@", 1)[-1].lower()
    for site in SITES:
        if any(domain == s or domain.endswith("." + s) for s in site.senders):
            return site
    for site in SITES:  # forwarded by hand: recognise the site from its links instead
        if any(site.job_link.search(u) for href, _ in links for u in _embedded_urls(href)):
            return site
    return None


def _decode(value: str | None) -> str:
    return str(make_header(decode_header(value))) if value else ""


def _html_of(message: email.message.Message) -> str:
    parts = message.walk() if message.is_multipart() else [message]
    html_parts, text_parts = [], []
    for part in parts:
        if part.get_content_maintype() == "multipart":
            continue
        payload = part.get_payload(decode=True) or b""
        text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
        (html_parts if part.get_content_type() == "text/html" else text_parts).append(text)
    if html_parts:
        return "\n".join(html_parts)
    # Plain-text email: turn bare URLs into links with the preceding line as their text
    body = "\n".join(text_parts)
    return "\n".join(f'<a href="{u}">{line}</a>' for line in body.splitlines() for u in re.findall(r"https?://\S+", line))


def read_emails() -> list[tuple[str, str, datetime | None, str]]:
    """(sender, subject, date, html) for recent emails, read-only."""
    address, password = os.environ.get("GMAIL_ADDRESS"), os.environ.get("GMAIL_APP_PASSWORD")
    if not (address and password):
        return []
    since = (datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)).strftime("%d-%b-%Y")
    mailbox = imaplib.IMAP4_SSL("imap.gmail.com")
    try:
        mailbox.login(address, password.replace(" ", ""))
        mailbox.select("INBOX", readonly=True)
        _, data = mailbox.search(None, f'(SINCE "{since}")')
        ids = data[0].split()[-MAX_EMAILS:]
        emails = []
        for message_id in ids:
            _, parts = mailbox.fetch(message_id, "(BODY.PEEK[])")
            message = email.message_from_bytes(parts[0][1])
            try:
                date = parsedate_to_datetime(message.get("Date"))
            except (TypeError, ValueError):
                date = None
            emails.append((parseaddr(message.get("From", ""))[1], _decode(message.get("Subject")), date,
                           _html_of(message)))
        return emails
    finally:
        try:
            mailbox.logout()
        except Exception:
            pass


def jobs_from_email(sender: str, date: datetime | None, html: str) -> list[RawJob]:
    parser = _Links()
    parser.feed(html)
    site = _site_for(sender, parser.links)
    if not site:
        return []
    jobs: dict[str, RawJob] = {}
    for href, text in parser.links:
        for candidate in _embedded_urls(href):
            if site.job_link.search(candidate):
                url = _canonical(candidate, site)
                title = text if 5 <= len(text) <= 160 and not GENERIC_TEXT.match(text) else ""
                existing = jobs.get(url)
                if existing and (existing.title or not title):
                    break
                jobs[url] = RawJob(
                    company=_company_from(url, site) or f"via {site.name}",
                    title=title,
                    url=url,
                    source_kind="inbox",
                    country="GB" if site.uk_only else None,
                    posted_at=date,
                    raw={"site": site.name},
                )
                break
    return [job for job in jobs.values() if job.title]


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    emails = await asyncio.to_thread(read_emails)
    jobs: list[RawJob] = []
    per_sender: dict[str, list[int]] = {}
    for sender, _, date, html in emails:
        found = jobs_from_email(sender, date, html)
        jobs.extend(found)
        counts = per_sender.setdefault(sender.rsplit("@", 1)[-1].lower(), [0, 0])
        counts[0] += 1
        counts[1] += len(found)
    # Safe for public logs: sender domains and counts only, never email content
    for domain, (email_count, job_count) in sorted(per_sender.items()):
        print(f"  inbox: {domain}: {email_count} emails -> {job_count} jobs")
    return jobs


def inspect() -> None:
    """Local troubleshooting only (never in public CI logs): what each recent email yields."""
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    for sender, subject, date, html in read_emails():
        jobs = jobs_from_email(sender, date, html)
        print(f"{date:%d %b %H:%M} | {sender.rsplit('@', 1)[-1]} | {subject[:70]} | {len(jobs)} jobs")
        for job in jobs[:5]:
            print(f"    {job.company} | {job.title} | {job.url}")


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    if "--inspect" in sys.argv:
        inspect()
