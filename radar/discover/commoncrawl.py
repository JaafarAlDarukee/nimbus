"""List URLs on a domain from Common Crawl's public index (a free copy of the web).

This asks Common Crawl, not the companies, so it's cheap and polite. The index rate-limits
bursts, so requests are spaced out and retried."""

from __future__ import annotations

import json
import time

import httpx

INDEX = "https://index.commoncrawl.org"
HEADERS = {"User-Agent": "NimbusRadar/0.1 (company discovery)"}
PAUSE = 4.0


def _get(client: httpx.Client, url: str, params: dict) -> httpx.Response:
    """GET with patience: the free index often answers 503 (busy) or 504 (timed out)."""
    response = None
    for attempt in range(8):
        try:
            response = client.get(url, params=params)
            if response.status_code not in (502, 503, 504):
                return response
        except httpx.TransportError:  # timeouts and connections dropped mid-download
            pass
        time.sleep(PAUSE * (attempt + 2))
    if response is None:
        raise TimeoutError(f"Common Crawl index kept timing out for {params.get('url')}")
    return response


def latest_index(client: httpx.Client) -> str:
    return client.get(f"{INDEX}/collinfo.json").json()[0]["cdx-api"]


def urls(pattern: str, max_pages: int = 50) -> list[str]:
    """Every captured URL matching `pattern` (e.g. '*.myworkdayjobs.com') in the latest crawl."""
    found: list[str] = []
    with httpx.Client(timeout=120, headers=HEADERS) as client:
        api = latest_index(client)
        time.sleep(PAUSE)
        pages = _get(client, api, {"url": pattern, "output": "json", "showNumPages": "true"})
        pages.raise_for_status()
        total = min(json.loads(pages.text)["pages"], max_pages)
        for page in range(total):
            time.sleep(PAUSE)
            try:
                response = _get(client, api, {"url": pattern, "output": "json", "fl": "url", "page": page})
            except TimeoutError as error:
                print(f"  {pattern}: skipping page {page + 1} ({error})")
                continue
            if response.status_code == 404:  # no captures on this page
                continue
            if response.is_error:
                print(f"  {pattern}: skipping page {page + 1} (HTTP {response.status_code})")
                continue
            for line in response.text.splitlines():
                try:
                    found.append(json.loads(line)["url"])
                except (ValueError, KeyError):
                    continue  # the index sometimes cuts a response short mid-line
            print(f"  {pattern}: page {page + 1}/{total}, {len(found)} urls so far")
    return found
