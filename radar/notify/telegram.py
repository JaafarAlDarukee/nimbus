"""The main Telegram channel (TELEGRAM_CHAT_ID): the owner's own, with EVERY new role the radar finds, no
filter (owner, 17 Oct: "I want to see everything posting in that", and it shows the radar is working).
UK and Ireland roles get a message each; the rest, and anything past MAX_SINGLE_PER_RUN, come as lists.
Personal bots (notify/personal.py) are the filtered version for each user."""

from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime

import httpx

# UK and Ireland roles get their own message, up to this many per check; then lists
MAX_SINGLE_PER_RUN = 60
ALERT_COUNTRIES = {"GB", "IE"}
# Telegram allows about 20 messages a minute in one channel
PAUSE = 3.1
# A message can hold 4,096 characters; lists stop a little before
LIST_CHARS = 3800

# Engineering, computing and science roles. The channel no longer filters by this (it posts everything);
# personal bots give engineering students every UK and Ireland role it covers (personal.py `wanted`).
ENGINEERING = {"mechanical", "manufacturing", "robotics", "electrical", "aerospace", "automotive",
               "materials", "civil", "chemical", "software", "engineering", "science"}
TECHNICAL_TITLE = re.compile(
    r"\b(engineer\w*|technical|technician|design|manufactur\w*|production|quality|maintenance|"
    r"r&d|research|scien\w+|lab\w*|mechanic\w*|robot\w*|automation|energy|sustainab\w+|environment\w*)\b",
    re.I,
)


def is_engineering(row: dict) -> bool:
    disciplines = set(row.get("disciplines") or [])
    if disciplines & ENGINEERING:
        return True
    return not disciplines and bool(TECHNICAL_TITLE.search(row.get("title") or ""))

KIND_LABELS = {
    "placement": "Placement", "internship": "Internship", "spring_week": "Spring week",
    "insight": "Insight / work experience", "grad_scheme": "Graduate scheme", "graduate_job": "Graduate job",
    "research": "Research", "apprenticeship": "Apprenticeship", "scholarship": "Scholarship",
    "event": "Event", "speculative": "Speculative", "other": "Opportunity", "unknown": "Opportunity",
}


def _date(value: str | None) -> str | None:
    return datetime.fromisoformat(value).strftime("%d %b") if value else None


def format_alert(row: dict) -> str:
    e = html.escape
    lines = [
        f"<b>New {e(KIND_LABELS.get(row['kind'], 'opportunity')).lower()}</b> · {e(row['company_name'])}",
        f"<b>{e(row['title'])}</b>",
    ]
    where = ", ".join(p for p in (row.get("location_text"), row.get("country")) if p)
    when = [f"posted {_date(row['posted_at'])}" if row.get("posted_at") else None,
            f"closes {_date(row['closes_at'])}" if row.get("closes_at") else None]
    details = " · ".join(p for p in [where, *when] if p)
    if details:
        lines.append(e(details))
    tags = ", ".join(row.get("disciplines") or [])
    skills = ", ".join(row.get("skills") or [])
    if tags or skills:
        lines.append(e(" · ".join(p for p in (tags, skills) if p)))
    if row.get("rolling"):
        lines.append("Rolling deadline: apply early")
    if row.get("source_kind") == "adzuna":
        lines.append("<i>via Adzuna (job board, may be a few days old)</i>")
    return "\n".join(lines)


def _send(client: httpx.Client, token: str, chat_id: str, text: str, url: str | None = None) -> bool:
    """Send one message, waiting when Telegram says slow down. A failure is counted, never fatal."""
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if url:
        payload["reply_markup"] = {"inline_keyboard": [[{"text": "Open and apply", "url": url}]]}
    for _ in range(5):
        response = client.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
        if response.status_code == 429:
            time.sleep(response.json().get("parameters", {}).get("retry_after", 5) + 1)
            continue
        if not response.is_success:
            print(f"Telegram: a channel message failed ({response.status_code})")
        return response.is_success
    return False


def _line(row: dict) -> str:
    """One role in a list message: type, linked title, employer, place."""
    e = html.escape
    where = row.get("location_text") or row.get("country") or ""
    title = e((row.get("title") or "")[:90])
    link = f'<a href="{e(row["apply_url"], quote=True)}">{title}</a>' if row.get("apply_url") else title
    parts = [f"{e(KIND_LABELS.get(row.get('kind') or '', 'Opportunity'))}: {link}", e((row.get("company_name") or "")[:40]), e(where[:40])]
    return "• " + " · ".join(p for p in parts if p)


def role_lists(heading: str, rows: list[dict]) -> list[str]:
    """Every role, packed into as few messages as fit (none dropped)."""
    messages: list[str] = []
    current = heading
    for row in rows:
        line = _line(row)
        if len(current) + 1 + len(line) > LIST_CHARS:
            messages.append(current)
            current = f"{heading} (continued)"
        current += "\n" + line
    if rows:
        messages.append(current)
    return messages


def send_new(rows: list[dict], first_run: bool, total_tracked: int) -> None:
    """Every new role, no filter: UK and Ireland one by one (up to MAX_SINGLE_PER_RUN), the rest as lists."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("Telegram not set up yet (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID); skipping alerts")
        return

    with httpx.Client(timeout=30) as client:
        if first_run:
            _send(client, token, chat_id,
                  f"<b>Nimbus is live</b>\nNow tracking {total_tracked} open opportunities. "
                  "From now on you'll get a message here the moment a new one appears.")
            return

        home = [r for r in rows if r.get("country") in ALERT_COUNTRIES]
        abroad = [r for r in rows if r.get("country") not in ALERT_COUNTRIES]
        singles, rest = home[:MAX_SINGLE_PER_RUN], home[MAX_SINGLE_PER_RUN:]
        sent = 0
        for row in singles:
            sent += _send(client, token, chat_id, format_alert(row), row.get("apply_url"))
            time.sleep(PAUSE)
        lists = role_lists(f"📋 <b>{len(rest)} more new roles in the UK and Ireland</b>", rest) + role_lists(
            f"🌍 <b>{len(abroad)} new roles abroad</b>", abroad)
        for text in lists:
            sent += _send(client, token, chat_id, text)
            time.sleep(PAUSE)
    print(f"Telegram channel: {sent} messages for {len(rows)} new roles ({len(home)} UK and Ireland, {len(abroad)} abroad)")
