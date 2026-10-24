"""Oracle Recruiting Cloud career sites (Cummins, Ford...), e.g. ref
`https://fa-espx-saasfaprod1.fa.ocs.oraclecloud.com|CX_1` (the host and the site number from
.../hcmUI/CandidateExperience/en/sites/CX_1).

Uses the same public JSON the career site calls. Newest jobs first: priority runs read the newest
pages (new jobs appear there), full runs read further back. Each listing already carries its
description, posting and closing dates, so no extra request per job."""

from __future__ import annotations

from ..geo import country_code
from ..http import Fetcher
from ..models import Board, RawJob
from ..text import html_to_text, parse_iso

PAGE = 25
PAGES = {"priority": 2, "full": 12}
_FACETS = "LOCATIONS%3BWORK_LOCATIONS%3BWORKPLACE_TYPES%3BTITLES%3BCATEGORIES%3BORGANIZATIONS%3BPOSTING_DATES%3BFLEX_FIELDS"


def _ref(board: Board) -> tuple[str, str]:
    host, _, site = board.ref.partition("|")
    return host.rstrip("/"), site or "CX_1"


async def fetch(board: Board, http: Fetcher, tier: str) -> list[RawJob]:
    host, site = _ref(board)
    jobs: list[RawJob] = []
    for page in range(PAGES.get(tier, 2)):
        # The finder's parameters are separated by commas inside one query value, as the site sends them
        url = (f"{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true"
               f"&expand=requisitionList.secondaryLocations,flexFieldsFacet.values"
               f"&finder=findReqs;siteNumber={site},facetsList={_FACETS},limit={PAGE},offset={page * PAGE},sortBy=POSTING_DATES_DESC")
        response = await http.get(url)
        response.raise_for_status()
        items = response.json().get("items") or [{}]
        listings = items[0].get("requisitionList") or []
        for job in listings:
            description = " ".join(html_to_text(job.get(k) or "") for k in ("ShortDescriptionStr", "ExternalResponsibilitiesStr",
                                                                               "ExternalQualificationsStr"))
            jobs.append(
                RawJob(
                    company=board.company,
                    title=(job.get("Title") or "").strip(),
                    url=f"{host}/hcmUI/CandidateExperience/en/sites/{site}/job/{job.get('Id')}",
                    source_kind="oracle",
                    location=job.get("PrimaryLocation") or "",
                    country=country_code(job.get("PrimaryLocationCountry")) or job.get("PrimaryLocationCountry"),
                    description=description.strip(),
                    posted_at=parse_iso(job.get("PostedDate")),
                    closes_at=parse_iso(job.get("PostingEndDate")),
                    remote=(job.get("WorkplaceTypeCode") or "").upper() == "ORA_REMOTE" or None,
                    raw={"employment": " ".join(filter(None, [job.get("WorkerType"), job.get("JobType"), job.get("ContractType")])) or None},
                )
            )
        if len(listings) < PAGE:
            break
    return jobs
