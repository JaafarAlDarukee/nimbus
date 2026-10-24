"""Send the roles the bot missed, after a fix to how roles are tagged (24 Oct: engineering roles
tagged as software, or with no subject, never reached the engineering-only bot). Looks again at
open UK and Ireland roles first seen in the last few days that opened in the last week, the same
rule as normal alerts, placements, internships, spring weeks and insight days only (not a pile of
apprenticeships). Subjects are worked out again with today's rules. `send_matches` applies everyone's
usual filters and never sends a role twice.
Boards added on 24 Oct (job lists, Oracle sites, careers pages) are left out: what they listed
when first read wasn't news.

Run by hand after `reclassify` (catch-up.yml). Logs print counts only.

    python -m radar.notify.catch_up --days 7
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone

from ..pipeline.classify import disciplines_for
from ..pipeline.exclusions import excluded
from ..store import _fetch_all, client
from .personal import BOT_KINDS, send_matches

NEW_SOURCES = ("sitemap", "oracle", "page")


def recent_roles(days: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    with client() as db:
        return _fetch_all(db, "/opportunities", {
            "select": "*",
            "status": "eq.open",
            "country": "in.(GB,IE)",
            "first_seen_at": f"gte.{(now - timedelta(days=days)).isoformat()}",
            "opened_at": f"gte.{(now - timedelta(days=7)).isoformat()}",
            "source_kind": f"not.in.({','.join(NEW_SOURCES)})",
        })


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Send roles the bot missed")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    rows = [r for r in recent_roles(args.days) if r.get("kind") in BOT_KINDS and not r.get("defence")
            and not excluded(r.get("company_name") or "", r.get("title") or "", r.get("description") or "")]
    for row in rows:
        row["disciplines"] = disciplines_for(row.get("title") or "", row.get("description") or "", row.get("company_name") or "")
    print(f"Looking again at {len(rows)} open UK and Ireland placements and internships from the last {args.days} days")
    send_matches(rows)


if __name__ == "__main__":
    main()
