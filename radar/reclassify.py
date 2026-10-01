"""Re-apply today's rules to every open opportunity already saved.

Fixes labels from older, looser rules (types and disciplines) and employer names saved before the
name tidy-up, closes jobs that are excluded or not for students, duplicates, and job-board copies
(Adzuna) that are no longer used. Closing is
reversible (status only). Prints counts only, since the logs are public.

    python -m radar.reclassify
"""

from __future__ import annotations

from collections import defaultdict

from .pipeline.classify import STAFF_ROLE, disciplines_for, fingerprint, kind_for
from .pipeline.exclusions import excluded
from .pipeline.names import clean_company_name
from .store import HINT_FIELDS as HINTS
from .store import _batches, _fetch_all, client

RETIRED_SOURCES: set[str] = set()


def main() -> None:
    with client() as db:
        rows = _fetch_all(
            db,
            "/opportunities",
            {
                "select": "id,fingerprint,title,company_name,city,location_text,description,kind,disciplines,source_kind,"
                + ",".join(f"{h}:raw->>{h}" for h in HINTS),
                "status": "eq.open",
                "order": "id",
            },
        )
        close: dict[str, list[str]] = defaultdict(list)
        relabel: dict[tuple[str, tuple[str, ...]], list[str]] = defaultdict(list)
        rename: list[tuple[str, str, str]] = []  # (id, clean name, new fingerprint)

        # Employer names saved before the name tidy-up ("cat", "1054 GlaxoSmithKline..."): rename them,
        # or close them when the tidy-named copy of the same job already exists
        taken = {r["fingerprint"] for r in _fetch_all(db, "/opportunities", {"select": "fingerprint", "order": "id"})}
        for row in rows:
            clean = clean_company_name(row["company_name"] or "")
            if clean == (row["company_name"] or ""):
                continue
            new_fp = fingerprint(clean, row["title"] or "", row.get("city") or row.get("location_text") or "")
            if new_fp != row["fingerprint"] and new_fp in taken:
                close["duplicate under an old name"].append(row["id"])
            else:
                rename.append((row["id"], clean, new_fp))
                taken.add(new_fp)
        duplicates = set(close["duplicate under an old name"])

        for row in rows:
            if row["id"] in duplicates:
                continue
            title, description = row["title"] or "", row["description"] or ""
            if row["kind"] == "event":  # event readers set type and subject themselves; nothing to re-derive
                continue
            if row["source_kind"] in RETIRED_SOURCES:
                close["job board copy"].append(row["id"])
                continue
            if excluded(row["company_name"] or "", title, description):
                close["excluded"].append(row["id"])
                continue
            hint = " ".join(str(row[h]) for h in HINTS if row.get(h)) or None
            kind = kind_for(title, hint)
            if kind is None:
                if STAFF_ROLE.search(title):
                    close["not a student role"].append(row["id"])
                    continue
                # The title alone doesn't say, and rows saved before 1 Oct 2026 have no hint kept:
                # trust the type given when it was saved
                kind = row["kind"]
            disciplines = disciplines_for(title, description)
            if kind != row["kind"] or sorted(disciplines) != sorted(row["disciplines"] or []):
                relabel[(kind, tuple(disciplines))].append(row["id"])

        for ids in close.values():
            for chunk in _batches(ids, 100):
                db.patch("/opportunities", params={"id": f"in.({','.join(chunk)})"}, json={"status": "closed"}).raise_for_status()
        for row_id, clean, new_fp in rename:
            db.patch("/opportunities", params={"id": f"eq.{row_id}"}, json={"company_name": clean, "fingerprint": new_fp}).raise_for_status()
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
    print(f"Renamed {len(rename)} employers to their tidy names")


if __name__ == "__main__":
    main()
