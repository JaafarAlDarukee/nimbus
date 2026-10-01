"""Readers, one per kind of job source. Each exposes `async fetch(board, http, tier) -> list[RawJob]`
and may expose `async enrich(job, http) -> RawJob` to fill in the description for shortlisted jobs."""

from . import (adzuna, ashby, devpost, events, greenhouse, inbox, lever, mlh, rss, sitemap, smartrecruiters,
               successfactors, workable, workday)

READERS = {
    "adzuna": adzuna,
    "ashby": ashby,
    "devpost": devpost,
    "events": events,
    "greenhouse": greenhouse,
    "inbox": inbox,
    "lever": lever,
    "mlh": mlh,
    "rss": rss,
    "sitemap": sitemap,
    "smartrecruiters": smartrecruiters,
    "successfactors": successfactors,
    "workable": workable,
    "workday": workday,
}
