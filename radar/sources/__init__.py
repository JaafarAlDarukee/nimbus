"""Readers, one per kind of job source. Each exposes `async fetch(board, http, tier) -> list[RawJob]`
and may expose `async enrich(job, http) -> RawJob` to fill in the description for shortlisted jobs."""

from . import adzuna, ashby, greenhouse, lever, rss, sitemap, smartrecruiters, successfactors, workable, workday

READERS = {
    "adzuna": adzuna,
    "ashby": ashby,
    "greenhouse": greenhouse,
    "lever": lever,
    "rss": rss,
    "sitemap": sitemap,
    "smartrecruiters": smartrecruiters,
    "successfactors": successfactors,
    "workable": workable,
    "workday": workday,
}
