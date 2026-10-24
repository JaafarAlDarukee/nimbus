"""Which hiring system does an employer's careers site use?

Opens a few likely careers pages (careers.<domain>, jobs.<domain>, <domain>/careers), only where
robots.txt allows, and looks for the fingerprints of hiring systems: the ones Nimbus reads (Workday,
SuccessFactors, Greenhouse, Lever, Ashby, SmartRecruiters, Workable) and the ones it doesn't yet.
Also tries a SuccessFactors career site's RSS feed and the site's sitemap. Prints what it finds,
never saves: boards are added to data/discovered/research.csv after a look.

Runs in GitHub Actions (careers-probe.yml), not on a home PC. Logs show employers and their public
careers URLs only.

    python -m radar.discover.careers_probe
"""

from __future__ import annotations

import asyncio
import re
import sys
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from ..http import USER_AGENT

# Employers to check: (name, main web domain). The owner's likely targets that Nimbus doesn't read yet.
TARGETS = [
    ("Bentley", "bentleymotors.com"), ("JCB", "jcb.com"), ("Reckitt", "reckitt.com"), ("Cummins", "cummins.com"),
    ("Arup", "arup.com"), ("McLaren", "mclaren.com"), ("Toyota UK", "toyotauk.com"), ("BMW Group", "bmwgroup.jobs"),
    ("National Grid", "nationalgrid.com"), ("Orsted", "orsted.co.uk"), ("Tata Steel UK", "tatasteeluk.com"),
    ("Mott MacDonald", "mottmac.com"), ("Spencer Group", "spencer-group.co.uk"), ("Phillips 66", "phillips66.com"),
    ("Ideal Heating", "idealheating.com"), ("Network Rail", "networkrail.co.uk"), ("AtkinsRealis", "atkinsrealis.com"),
    ("WSP", "wsp.com"), ("Balfour Beatty", "balfourbeatty.com"), ("Alstom", "alstom.com"), ("Severn Trent", "severntrent.com"),
    ("Yorkshire Water", "yorkshirewater.com"), ("INEOS", "ineos.com"), ("Croda", "croda.com"), ("RWE", "rwe.com"),
    ("Equinor", "equinor.com"), ("Williams Racing", "williamsf1.com"), ("Aston Martin", "astonmartin.com"),
    ("Leyland Trucks", "leylandtrucks.co.uk"), ("Ford UK", "ford.co.uk"), ("Honda UK", "honda.co.uk"), ("Kier", "kier.co.uk"),
    ("Laing O'Rourke", "laingorourke.com"),
]

SYSTEMS = [
    ("workday", r"https?://[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com/[A-Za-z0-9_/.-]+"),
    ("successfactors", r"https?://[a-z0-9.-]*(?:successfactors|sapsf|jobs2web)\.(?:com|eu)[^\s\"'<>]*"),
    ("greenhouse", r"(?:boards|job-boards)(?:-api)?\.greenhouse\.io/[a-z0-9_-]+"),
    ("lever", r"jobs\.lever\.co/[a-z0-9_-]+"),
    ("ashby", r"jobs\.ashbyhq\.com/[A-Za-z0-9_-]+"),
    ("smartrecruiters", r"(?:careers|jobs)\.smartrecruiters\.com/[A-Za-z0-9_-]+"),
    ("workable", r"apply\.workable\.com/[a-z0-9_-]+"),
    ("oracle", r"https?://[a-z0-9-]+\.fa\.[a-z0-9-]+\.oraclecloud\.com/hcmUI/CandidateExperience[^\s\"'<>]*"),
    ("eightfold", r"https?://[a-z0-9-]+\.eightfold\.ai[^\s\"'<>]*"),
    ("avature", r"https?://[a-z0-9-]+\.avature\.net[^\s\"'<>]*"),
    ("icims", r"https?://[a-z0-9-]+\.icims\.com[^\s\"'<>]*"),
    ("taleo", r"https?://[a-z0-9-]+\.taleo\.net[^\s\"'<>]*"),
    ("phenom", r"phenompeople\.com|phenom\.com/"),
    ("pinpoint", r"[a-z0-9-]+\.pinpointhq\.com"),
    ("teamtailor", r"[a-z0-9-]+\.teamtailor\.com"),
    ("recruitee", r"[a-z0-9-]+\.recruitee\.com"),
    ("personio", r"[a-z0-9-]+\.jobs\.personio\.(?:de|com)"),
    ("jobvite", r"jobs\.jobvite\.com/[a-z0-9_-]+"),
    ("bamboohr", r"[a-z0-9-]+\.bamboohr\.com"),
    ("tribepad", r"tribepad"),
    ("networx", r"networxrecruitment|\.networx\."),
    ("cornerstone", r"[a-z0-9-]+\.csod\.com"),
    ("talos360", r"talos360"),
    ("beapplied", r"beapplied\.com"),
]


class Robots:
    """robots.txt per host, fetched once; unreadable robots.txt means "ask nothing"."""

    def __init__(self, http: httpx.AsyncClient):
        self.http = http
        self.cache: dict[str, RobotFileParser | None] = {}

    async def allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        host = f"{parts.scheme}://{parts.netloc}"
        if host not in self.cache:
            try:
                response = await self.http.get(f"{host}/robots.txt")
                if response.status_code >= 500:
                    self.cache[host] = None
                else:
                    parser = RobotFileParser()
                    parser.parse(response.text.splitlines() if response.status_code == 200 else [])
                    self.cache[host] = parser
            except httpx.HTTPError:
                self.cache[host] = None
        parser = self.cache[host]
        return parser is not None and parser.can_fetch(USER_AGENT, url)


async def _get(http: httpx.AsyncClient, robots: Robots, url: str) -> httpx.Response | None:
    if not await robots.allowed(url):
        return None
    try:
        response = await http.get(url)
        return response if response.status_code == 200 else None
    except httpx.HTTPError:
        return None


async def probe(http: httpx.AsyncClient, robots: Robots, name: str, domain: str) -> str:
    found: dict[str, str] = {}
    pages = []
    for url in (f"https://careers.{domain}", f"https://jobs.{domain}", f"https://www.{domain}/careers", f"https://{domain}/careers",
                f"https://www.{domain}"):
        response = await _get(http, robots, url)
        if response is None:
            continue
        pages.append(str(response.url))
        text = f"{response.url} {response.text[:400_000]}"
        for system, pattern in SYSTEMS:
            match = re.search(pattern, text, re.I)
            if match and system not in found:
                found[system] = match.group(0)[:120]
        if len(pages) >= 2:
            break
    # A SuccessFactors career site answers its RSS feed; a sitemap may list the jobs
    hosts = {urlsplit(p).netloc for p in pages}
    extras = []
    for host in sorted(hosts):
        rss = await _get(http, robots, f"https://{host}/services/rss/job/?locale=en_GB&keywords=placement")
        if rss is not None and "<rss" in rss.text[:500]:
            extras.append(f"successfactors-rss https://{host} ({rss.text.count('<item>')} placement items)")
        sitemap = await _get(http, robots, f"https://{host}/sitemap.xml")
        if sitemap is not None:
            jobs = len(re.findall(r"<loc>[^<]*/(?:job|jobs|vacanc)[^<]*</loc>", sitemap.text, re.I))
            if jobs:
                extras.append(f"sitemap https://{host}/sitemap.xml ({jobs} job links)")
    systems = "; ".join(f"{s} {u}" for s, u in found.items()) or "no known system on the page"
    where = pages[0] if pages else "no careers page reachable (or robots.txt says no)"
    return f"{name}: {where} | {systems}" + (f" | {' | '.join(extras)}" if extras else "")


async def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    async with httpx.AsyncClient(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=25.0) as http:
        robots = Robots(http)
        for name, domain in TARGETS:  # one employer at a time: a handful of requests each
            print(await probe(http, robots, name, domain), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
