"""Tell the admin on Telegram (their private chat with the bot) about new access requests."""

from __future__ import annotations

import os
from datetime import datetime, timezone

import httpx

from ..store import client


def notify_access_requests() -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_ADMIN_CHAT_ID")
    if not (token and chat_id):
        return

    with client() as db:
        response = db.get(
            "/access_requests",
            params={"select": "id,email", "status": "eq.pending", "notified_at": "is.null", "order": "created_at"},
        )
        response.raise_for_status()
        requests = response.json()
        if not requests:
            return

        with httpx.Client(timeout=30) as telegram:
            for request in requests:
                sent = telegram.post(
                    f"https://api.telegram.org/bot{token}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": f"New Nimbus access request\n{request['email']}\n\nApprove or decline it on the Nimbus admin page.",
                        "disable_web_page_preview": True,
                    },
                )
                if sent.is_success:
                    db.patch(
                        "/access_requests",
                        params={"id": f"eq.{request['id']}"},
                        json={"notified_at": datetime.now(timezone.utc).isoformat()},
                    ).raise_for_status()
    # Counts only: logs are public
    print(f"Admin: told about {len(requests)} new access request(s)")
