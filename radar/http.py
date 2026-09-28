from __future__ import annotations

import asyncio
from urllib.parse import urlsplit

import httpx

USER_AGENT = "Mozilla/5.0 (compatible; NimbusRadar/0.1; student job alerts)"


class Fetcher:
    """Shared HTTP client that stays polite: a few requests at a time per host, with retries."""

    def __init__(self, per_host: int = 3, total: int = 24, timeout: float = 25.0):
        self._client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/xml, */*"},
        )
        self._per_host = per_host
        self._limits: dict[str, asyncio.Semaphore] = {}
        # Many company sites share one provider's servers (e.g. every *.myworkdayjobs.com),
        # so there is also a cap on requests in flight overall
        self._total = asyncio.Semaphore(total)

    def _limit(self, url: str) -> asyncio.Semaphore:
        host = urlsplit(url).hostname or ""
        if host not in self._limits:
            self._limits[host] = asyncio.Semaphore(self._per_host)
        return self._limits[host]

    async def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        async with self._limit(url), self._total:
            for attempt in range(3):
                response = await self._client.request(method, url, **kwargs)
                if response.status_code not in (429, 500, 502, 503, 504) or attempt == 2:
                    return response
                await asyncio.sleep(2 * (attempt + 1))
        raise AssertionError("unreachable")

    async def get(self, url: str, **kwargs) -> httpx.Response:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> httpx.Response:
        return await self.request("POST", url, **kwargs)

    async def aclose(self) -> None:
        await self._client.aclose()
