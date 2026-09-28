from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Board:
    """One place a company lists jobs (a hiring-system board, feed or sitemap)."""

    company: str
    kind: str  # workday, greenhouse, lever, ashby, smartrecruiters, workable, rss, sitemap
    ref: str  # slug or URL, depending on kind
    tier: str = "standard"
    notes: str = ""


@dataclass
class RawJob:
    """A job exactly as a reader found it, before classification."""

    company: str
    title: str
    url: str
    source_kind: str
    location: str = ""
    country: str | None = None
    description: str = ""
    posted_at: datetime | None = None
    closes_at: datetime | None = None
    remote: bool | None = None
    raw: dict = field(default_factory=dict)


@dataclass
class Opportunity:
    """A classified early-careers opportunity, ready to store and alert on."""

    fingerprint: str
    company: str
    title: str
    kind: str
    apply_url: str
    source_kind: str
    location: str = ""
    country: str | None = None
    city: str | None = None
    remote: bool | None = None
    disciplines: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    description: str = ""
    posted_at: datetime | None = None
    closes_at: datetime | None = None
    rolling: bool | None = None
    raw: dict = field(default_factory=dict)
