"""Send the roles the bot missed, after a fix to how roles are tagged (24 Oct: engineering roles
tagged as software, or with no subject, never reached the engineering-only bot). Looks again at
open UK and Ireland roles first seen in the last few days that opened in the last week, the same
rule as normal alerts; `send_matches` applies everyone's usual filters and never sends a role twice.
Boards added on 24 Oct (job lists, Oracle sites, careers pages) are left out: what they listed
when first read wasn't news.

Run by hand after `reclassify` (catch-up.yml). Logs print counts only.

    python -m radar.notify.catch_up --days 7
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone

from ..store import _fetch_all, client
from .personal import send_matches

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
    rows = recent_roles(args.days)
    print(f"Looking again at {len(rows)} open UK and Ireland roles from the last {args.days} days")
    send_matches(rows)


if __name__ == "__main__":
    main()
