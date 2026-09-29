"""Telegram alerts for new opportunities. Messages go to TELEGRAM_CHAT_ID (you, or your group)."""

from __future__ import annotations

import html
import os
import re
import time
from datetime import datetime

import httpx

MAX_MESSAGES_PER_RUN = 25
ALERT_COUNTRIES = {"GB", "IE"}

# The shared channel is for engineering-type roles. Everything else is still saved (for the
# website and friends' own filters later), it just doesn't ping the channel.
ENGINEERING = {"mechanical", "manufacturing", "robotics", "electrical", "aerospace", "automotive",
               "materials", "civil", "chemical"}
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
    return "\n".join(lines)


def _send(client: httpx.Client, token: str, chat_id: str, text: str, url: str | None = None) -> None:
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
    if url:
        payload["reply_markup"] = {"inline_keyboard": [[{"text": "Open and apply", "url": url}]]}
    response = client.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
    if response.status_code == 429:
        time.sleep(response.json().get("parameters", {}).get("retry_after", 5))
        response = client.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
    response.raise_for_status()


def send_new(rows: list[dict], first_run: bool, total_tracked: int) -> None:
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

        alerts = [r for r in rows if r.get("country") in ALERT_COUNTRIES and is_engineering(r)]
        for row in alerts[:MAX_MESSAGES_PER_RUN]:
            _send(client, token, chat_id, format_alert(row), row.get("apply_url"))
            time.sleep(1.1)  # Telegram allows about one message per second per chat
        if len(alerts) > MAX_MESSAGES_PER_RUN:
            _send(client, token, chat_id,
                  f"…and {len(alerts) - MAX_MESSAGES_PER_RUN} more new opportunities this round.")
    print(f"Telegram: sent {min(len(alerts), MAX_MESSAGES_PER_RUN)} alerts")
