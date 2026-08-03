from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from ..domain import STATUS_LABELS
from ..models import Notification, NotificationPreference, Ticket, TicketComment, User
from ..permissions import has_permission
from ..time_utils import utc_now

NOTIFICATION_PAGE_SIZE = 50


def _create(db: Session, user_id: int | None, event_type: str, sound_kind: str, message: str, ticket_id: int | None) -> None:
    if user_id is None:
        return
    db.add(
        Notification(
            user_id=user_id,
            event_type=event_type,
            sound_kind=sound_kind,
            message=message,
            ticket_id=ticket_id,
        )
    )


def notify_ticket_created(db: Session, ticket: Ticket, actor: User) -> None:
    message = f"Novo chamado #{ticket.id} aberto: {ticket.category}."
    recipients = db.scalars(select(User).where(User.active.is_(True), User.id != actor.id))
    for user in recipients:
        if has_permission(db, user, "tickets.view_all"):
            _create(db, user.id, "ticket_created", "voice", message, ticket.id)


def notify_ticket_assigned(db: Session, ticket: Ticket, actor: User, new_assignee_id: int | None) -> None:
    if new_assignee_id is None or new_assignee_id == actor.id:
        return
    message = f"O chamado #{ticket.id} foi atribuído a você."
    _create(db, new_assignee_id, "ticket_assigned", "standard", message, ticket.id)


def notify_ticket_status_changed(db: Session, ticket: Ticket, actor: User, new_status: str) -> None:
    label = STATUS_LABELS.get(new_status, new_status)
    message = f'O chamado #{ticket.id} mudou para "{label}".'
    if ticket.requester_id != actor.id:
        _create(db, ticket.requester_id, "ticket_status_changed", "standard", message, ticket.id)
    if ticket.assignee_id is not None and ticket.assignee_id != actor.id and ticket.assignee_id != ticket.requester_id:
        _create(db, ticket.assignee_id, "ticket_status_changed", "standard", message, ticket.id)


def notify_ticket_comment(db: Session, ticket: Ticket, comment: TicketComment, actor: User) -> None:
    message = f"Nova mensagem no chamado #{ticket.id}."
    if comment.internal:
        if ticket.assignee_id is not None and ticket.assignee_id != actor.id:
            _create(db, ticket.assignee_id, "ticket_comment", "standard", message, ticket.id)
        return
    if actor.id == ticket.requester_id:
        if ticket.assignee_id is not None and ticket.assignee_id != actor.id:
            _create(db, ticket.assignee_id, "ticket_comment", "standard", message, ticket.id)
    elif ticket.requester_id != actor.id:
        _create(db, ticket.requester_id, "ticket_comment", "standard", message, ticket.id)


def list_notifications(db: Session, current_user: User, limit: int = NOTIFICATION_PAGE_SIZE) -> list[Notification]:
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list(db.scalars(query))


def unread_count(db: Session, current_user: User) -> int:
    return (
        db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.read_at.is_(None),
            )
        )
        or 0
    )


def mark_read(db: Session, current_user: User, notification_id: int) -> bool:
    notification = db.get(Notification, notification_id)
    if not notification or notification.user_id != current_user.id:
        return False
    if notification.read_at is None:
        notification.read_at = utc_now()
        db.commit()
    return True


def mark_all_read(db: Session, current_user: User) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read_at.is_(None))
        .values(read_at=utc_now())
    )
    db.commit()


def get_preferences(db: Session, current_user: User) -> NotificationPreference:
    preferences = db.get(NotificationPreference, current_user.id)
    if not preferences:
        preferences = NotificationPreference(user_id=current_user.id)
        db.add(preferences)
        db.commit()
        db.refresh(preferences)
    return preferences


def update_preferences(
    db: Session,
    current_user: User,
    master_muted: bool | None,
    voice_muted: bool | None,
    standard_sound_muted: bool | None,
) -> NotificationPreference:
    preferences = get_preferences(db, current_user)
    if master_muted is not None:
        preferences.master_muted = master_muted
    if voice_muted is not None:
        preferences.voice_muted = voice_muted
    if standard_sound_muted is not None:
        preferences.standard_sound_muted = standard_sound_muted
    db.commit()
    db.refresh(preferences)
    return preferences
