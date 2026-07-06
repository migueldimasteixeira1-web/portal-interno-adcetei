from typing import Any

from ..models import Ticket, TicketComment
from .assets import serialize_asset, serialize_asset_option
from .users import serialize_user


def serialize_comment(comment: TicketComment) -> dict[str, Any]:
    return {
        "id": comment.id,
        "body": comment.body,
        "internal": comment.internal,
        "event_type": comment.event_type,
        "created_at": comment.created_at,
        "author": serialize_user(comment.author),
    }


def serialize_ticket(
    ticket: Ticket,
    include_comments: bool = False,
    can_view_internal: bool = False,
    include_sensitive_asset: bool = True,
) -> dict[str, Any]:
    data = {
        "id": ticket.id,
        "title": ticket.title,
        "status": ticket.status,
        "priority": ticket.priority,
        "category": ticket.category,
        "team": ticket.team,
        "requester": serialize_user(ticket.requester),
        "assignee": serialize_user(ticket.assignee),
        "asset": serialize_asset(ticket.asset) if include_sensitive_asset else serialize_asset_option(ticket.asset),
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "due_at": ticket.due_at,
    }
    if include_comments:
        comments = ticket.comments or []
        if not can_view_internal:
            comments = [item for item in comments if not item.internal]
        data.update(
            {
                "description": ticket.description,
                "service_id": ticket.service_id,
                "form_data": ticket.form_data or {},
                "form_schema_snapshot": ticket.form_schema_snapshot or {},
                "urgency": ticket.urgency,
                "impact": ticket.impact,
                "origin": ticket.origin,
                "location": ticket.location,
                "closed_at": ticket.closed_at,
                "comments": [serialize_comment(item) for item in comments],
            }
        )
    return data
