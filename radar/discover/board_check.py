"""Why does a board find nothing? For each board whose company name contains one of the given
words: how many jobs its reader saw, how many look like student roles, and how many survive
classification, with a few examples at each step. For a job list (sitemap) that saw nothing, the
start of the sitemap itself. Nothing is saved.

Runs in GitHub Actions (radar-test.yml, "details"), not on a home PC. Logs show employers' public
job ads only (never inbox boards).

    python -m radar.discover.board_check "Kier,Reckitt"
"""

from __future__ import annotations

import asyncio
import sys

from ..http import Fetcher
from ..pipeline.classify import classify, is_candidate
from ..run import _enrich, load_boards
from ..sources import READERS


async def check(names: list[str]) -> None:
    boards = [b for b in load_boards(None) if b.kind != "inbox" and any(n.lower() in b.company.lower() for n in names)]
    http = Fetcher()
    try:
        for board in boards:
            print(f"== {board.company} [{board.kind}] {board.ref}")
            try:
                jobs = await READERS[board.kind].fetch(board, http, "full")
            except Exception as error:
                print(f"   reader failed: {type(error).__name__}: {str(error)[:200]}")
                continue
            print(f"   seen {len(jobs)}: " + " · ".join(f"{j.title[:60]} ({j.country or '?'})" for j in jobs[:4]))
            if not jobs and board.kind == "sitemap":
                response = await http.get(board.ref.split("|")[0])
                start = " ".join(response.text[:400].split())
                print(f"   sitemap: HTTP {response.status_code} {response.headers.get('content-type', '?')} | {start}")
            if not jobs and board.kind == "oracle":
                host, _, site = board.ref.partition("|")
                response = await http.get(f"{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true"
                                          f"&finder=findReqs;siteNumber={site or 'CX_1'},limit=5")
                print(f"   oracle: HTTP {response.status_code} | {' '.join(response.text[:400].split())}")
            candidates = [j for j in jobs if is_candidate(j)]
            print(f"   student-like {len(candidates)}: " + " · ".join(j.title[:60] for j in candidates[:4]))
            kept, dropped = [], []
            for job in candidates[:15]:
                job = await _enrich(board, job, http) if job.country in (None, "GB", "IE") else job
                (kept if classify(job) else dropped).append(job)
            print(f"   of the first {min(len(candidates), 15)}: kept {len(kept)}, dropped {len(dropped)}")
            for job in kept[:4]:
                o = classify(job)
                print(f"     kept [{o.kind}] {o.title[:70]} | {o.location or '-'} ({o.country or '?'})")
            for job in dropped[:4]:
                print(f"     dropped {job.title[:70]}")
    finally:
        await http.aclose()


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    asyncio.run(check([n.strip() for n in " ".join(sys.argv[1:]).split(",") if n.strip()]))
