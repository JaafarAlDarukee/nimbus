"""Re-apply today's rules to every open opportunity already saved.

Fixes labels from older, looser rules (types and disciplines), closes jobs that are excluded or
not for students, and closes job-board copies (Adzuna) that are no longer used. Closing is
reversible (status only). Prints counts only, since the logs are public.

    python -m radar.reclassify
"""

from __future__ import annotations

from collections import defaultdict

from .pipeline.classify import disciplines_for, kind_for
from .pipeline.exclusions import excluded
from .store import _batches, _fetch_all, client

RETIRED_SOURCES = {"adzuna"}
HINTS = ("employmentType", "commitment", "experience", "employment")


def main() -> None:
    with client() as db:
        rows = _fetch_all(
            db,
            "/opportunities",
            {
                "select": "id,title,company_name,description,kind,disciplines,source_kind,"
                + ",".join(f"{h}:raw->>{h}" for h in HINTS),
                "status": "eq.open",
                "order": "id",
            },
        )
        close: dict[str, list[str]] = defaultdict(list)
        relabel: dict[tuple[str, tuple[str, ...]], list[str]] = defaultdict(list)

        for row in rows:
            title, description = row["title"] or "", row["description"] or ""
            if row["source_kind"] in RETIRED_SOURCES:
                close["job board copy"].append(row["id"])
                continue
            if excluded(row["company_name"] or "", title, description):
                close["excluded"].append(row["id"])
                continue
            hint = " ".join(str(row[h]) for h in HINTS if row.get(h)) or None
            kind = kind_for(title, hint)
            if kind is None:
                close["not a student role"].append(row["id"])
                continue
            disciplines = disciplines_for(title, description)
            if kind != row["kind"] or sorted(disciplines) != sorted(row["disciplines"] or []):
                relabel[(kind, tuple(disciplines))].append(row["id"])

        for ids in close.values():
            for chunk in _batches(ids, 100):
                db.patch("/opportunities", params={"id": f"in.({','.join(chunk)})"}, json={"status": "closed"}).raise_for_status()
        for (kind, disciplines), ids in relabel.items():
            for chunk in _batches(ids, 100):
                db.patch(
                    "/opportunities",
                    params={"id": f"in.({','.join(chunk)})"},
                    json={"kind": kind, "disciplines": list(disciplines)},
                ).raise_for_status()

    print(f"Checked {len(rows)} open opportunities")
    for reason, ids in close.items():
        print(f"Closed {len(ids)}: {reason}")
    print(f"Relabelled {sum(len(ids) for ids in relabel.values())}")


if __name__ == "__main__":
    main()
