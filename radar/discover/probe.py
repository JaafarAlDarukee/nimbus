"""Find the hiring-system boards of named companies (the Companies directory) by asking each
system's public API directly, instead of waiting for them to turn up in a web crawl.

A board is kept only when the system confirms the company's name (Greenhouse, Workable), or the
board's address is the company's full name and it has jobs (Lever, Ashby, which don't say whose
board it is). Public job-list APIs only; nothing is scraped.

    python -m radar.discover.probe            # probe and merge into data/discovered/*.csv
    python -m radar.discover.probe --dry-run  # just print what it would add
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
from pathlib import Path

from ..http import Fetcher
from ..match import normalise_company
from . import save_boards

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "web" / "src" / "lib" / "companies-data.ts"


def directory_names() -> list[str]:
    text = DIRECTORY.read_text(encoding="utf-8")
    body = text[text.index("= {") + 2: text.index("\n};") + 2]
    data = json.loads(re.sub(r",\s*}$", "}", body.strip()))
    return sorted({entry.split("|")[0] for entries in data.values() for entry in entries})


def slugs(name: str) -> list[str]:
    """'Octopus Energy' -> octopusenergy, octopus-energy, octopus (the short form only for long names)."""
    words = normalise_company(re.sub(r"\(.*?\)", "", name)).split()
    if not words:
        return []
    full, dashed = "".join(words), "-".join(words)
    out = [full, dashed]
    if len(words) > 1 and len(words[0]) >= 5:
        out.append(words[0])
    return list(dict.fromkeys(out))


def same_company(found: str, wanted: str) -> bool:
    """The board's own name is the company, or the company's longer legal name ("Wayve Technologies")."""
    a, b = normalise_company(found), normalise_company(re.sub(r"\(.*?\)", "", wanted))
    return bool(a) and bool(b) and (a == b or a.startswith(b + " "))


def distinctive(name: str) -> bool:
    """Short names (BP, Arm, NICE, ICON) belong to too many companies to probe by name."""
    norm = normalise_company(re.sub(r"\(.*?\)", "", name))
    return len(norm.replace(" ", "")) >= 5


async def probe(name: str, http: Fetcher) -> list[dict]:
    found: list[dict] = []
    full = "".join(normalise_company(name).split())
    for slug in slugs(name):
        try:
            r = await http.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}")
            if r.status_code == 200 and same_company(r.json().get("name", ""), name):
                jobs = await http.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
                n = len(jobs.json().get("jobs", [])) if jobs.status_code == 200 else 0
                if n:
                    found.append({"company": name, "kind": "greenhouse", "ref": slug, "tier": "standard", "notes": f"probe: name confirmed, {n} jobs"})
            r = await http.get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
            if r.status_code == 200 and same_company(r.json().get("name", ""), name):
                n = len(r.json().get("jobs", []))
                if n:
                    found.append({"company": name, "kind": "workable", "ref": slug, "tier": "standard", "notes": f"probe: name confirmed, {n} jobs"})
            if slug == full:
                r = await http.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json", "limit": 50})
                if r.status_code == 200 and isinstance(r.json(), list) and r.json():
                    found.append({"company": name, "kind": "lever", "ref": slug, "tier": "standard", "notes": f"probe: full-name board, {len(r.json())}+ jobs"})
                r = await http.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
                if r.status_code == 200 and r.json().get("jobs"):
                    found.append({"company": name, "kind": "ashby", "ref": slug, "tier": "standard", "notes": f"probe: full-name board, {len(r.json()['jobs'])} jobs"})
        except Exception:  # one company's odd answer shouldn't stop the rest
            continue
    return found


async def run(dry_run: bool) -> None:
    names = [n for n in directory_names() if distinctive(n)]
    http = Fetcher(per_host=4)
    try:
        results = await asyncio.gather(*(probe(n, http) for n in names))
    finally:
        await http.aclose()
    boards = [b for found in results for b in found]
    by_kind: dict[str, list[dict]] = {}
    for b in boards:
        by_kind.setdefault(b["kind"], []).append(b)
    print(f"Probed {len(names)} companies: found {len(boards)} boards for {len({b['company'] for b in boards})} of them")
    for kind, rows in sorted(by_kind.items()):
        print(f"  {kind}: {len(rows)}")
        if dry_run:
            for row in rows:
                print(f"    {row['company']} -> {row['ref']} ({row['notes']})")
        else:
            save_boards(kind, rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(run(parser.parse_args().dry_run))
