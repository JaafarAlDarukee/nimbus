from __future__ import annotations

import asyncio
from urllib.parse import urlsplit

import httpx

USER_AGENT = "Mozilla/5.0 (compatible; NimbusRadar/0.1; student job alerts)"
RETRY_STATUS = {429, 500, 502, 503, 504}
# Workday rate-limits each server group (wd1, wd3, wd5...) as a whole, not each company on it
SHARED_CLUSTERS = (".myworkdayjobs.com", ".myworkdaysite.com")


class Fetcher:
    """Shared HTTP client that stays polite: a few requests at a time per site (per Workday server
    group), waiting when a site says it's busy, with retries."""

    def __init__(self, per_host: int = 3, per_cluster: int = 5, total: int = 24, timeout: float = 25.0):
        self._client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/xml, */*"},
        )
        self._per_host = per_host
        self._per_cluster = per_cluster
        self._limits: dict[str, asyncio.Semaphore] = {}
        # Many company sites share one provider's servers, so there is also a cap on requests in flight overall
        self._total = asyncio.Semaphore(total)

    def _limit(self, url: str) -> asyncio.Semaphore:
        host = urlsplit(url).hostname or ""
        if host.endswith(SHARED_CLUSTERS):
            key, size = ".".join(host.split(".")[-3:]), self._per_cluster  # e.g. wd1.myworkdayjobs.com
        else:
            key, size = host, self._per_host
        if key not in self._limits:
            self._limits[key] = asyncio.Semaphore(size)
        return self._limits[key]

    @staticmethod
    def _wait(response: httpx.Response, attempt: int) -> float:
        """How long to back off: the site's own Retry-After when it gives one, else 5s, 15s, 45s."""
        try:
            return min(60.0, float(response.headers.get("retry-after", "")))
        except ValueError:
            return min(60.0, 5.0 * 3**attempt)

    async def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        async with self._limit(url):
            for attempt in range(4):
                try:
                    async with self._total:
                        response = await self._client.request(method, url, **kwargs)
                except (httpx.TimeoutException, httpx.TransportError):
                    # One more go after a short pause; a second failure is reported as usual
                    if attempt >= 1:
                        raise
                    await asyncio.sleep(3)
                    continue
                if response.status_code not in RETRY_STATUS or attempt == 3:
                    return response
                # Wait outside the overall cap, so other sites keep going meanwhile
                await asyncio.sleep(self._wait(response, attempt))
        raise AssertionError("unreachable")

    async def get(self, url: str, **kwargs) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def aclose(self) -> None:
        await self._client.aclose()
