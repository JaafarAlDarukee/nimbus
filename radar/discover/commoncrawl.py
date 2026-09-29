"""List URLs on a domain from Common Crawl's public index (a free copy of the web).

This asks Common Crawl, not the companies, so it's cheap and polite. The free index is often
overloaded (503 busy, 504 timed out, cut-off replies), so: requests are spaced out and retried,
pages that still fail get a second pass at the end, and several monthly crawls are combined so
one bad snapshot doesn't leave gaps."""

from __future__ import annotations

import json
import time

import httpx

INDEX = "https://index.commoncrawl.org"
HEADERS = {"User-Agent": "NimbusRadar/0.1 (company discovery)"}
PAUSE = 4.0
CRAWLS = 3


def _get(client: httpx.Client, url: str, params: dict, attempts: int = 6) -> httpx.Response | None:
    for attempt in range(attempts):
        try:
            response = client.get(url, params=params)
            if response.status_code not in (502, 503, 504):
                return response
        except httpx.TransportError:  # timeouts and connections dropped mid-download
            pass
        time.sleep(PAUSE * (attempt + 2))
    return None


def recent_indexes(client: httpx.Client, count: int = CRAWLS) -> list[str]:
    response = _get(client, f"{INDEX}/collinfo.json", {})
    return [crawl["cdx-api"] for crawl in response.json()[:count]] if response else []


def _page_count(client: httpx.Client, api: str, pattern: str) -> int | None:
    response = _get(client, api, {"url": pattern, "output": "json", "showNumPages": "true"})
    try:
        return json.loads(response.text)["pages"] if response and response.status_code == 200 else None
    except (ValueError, KeyError):
        return None


def _read_page(client: httpx.Client, api: str, pattern: str, page: int, found: set[str]) -> bool:
    response = _get(client, api, {"url": pattern, "output": "json", "fl": "url", "page": page})
    if response is None or response.is_error:
        return response is not None and response.status_code == 404  # 404 = no captures: fine
    for line in response.text.splitlines():
        try:
            found.add(json.loads(line)["url"])
        except (ValueError, KeyError):
            continue  # the index sometimes cuts a response short mid-line
    return True


def urls(pattern: str, max_pages: int = 50) -> list[str]:
    """Every captured URL matching `pattern` (e.g. '*.myworkdayjobs.com') in recent crawls."""
    found: set[str] = set()
    with httpx.Client(timeout=120, headers=HEADERS) as client:
        for api in recent_indexes(client):
            crawl = api.rsplit("/", 1)[-1]
            time.sleep(PAUSE)
            pages = _page_count(client, api, pattern)
            if pages is None:
                print(f"  {pattern} [{crawl}]: index unavailable, skipping this crawl")
                continue
            failed = []
            for page in range(min(pages, max_pages)):
                time.sleep(PAUSE)
                if not _read_page(client, api, pattern, page, found):
                    failed.append(page)
            for page in list(failed):  # second chance once the index has had a rest
                time.sleep(PAUSE * 3)
                if _read_page(client, api, pattern, page, found):
                    failed.remove(page)
            print(f"  {pattern} [{crawl}]: {pages} pages, {len(failed)} unreadable, {len(found)} urls so far")
    return sorted(found)
