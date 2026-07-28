from dataclasses import dataclass

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.orm import Session

from ..models import ChatMessage, User
from ..time_utils import utc_now

MESSAGE_PAGE_SIZE = 50


@dataclass
class ConversationSummary:
    contact: User
    last_message: ChatMessage | None
    unread_count: int


def _conversation_conditions(user_id: int, partner_id: int):
    return or_(
        and_(ChatMessage.sender_id == user_id, ChatMessage.recipient_id == partner_id),
        and_(ChatMessage.sender_id == partner_id, ChatMessage.recipient_id == user_id),
    )


def search_contacts(db: Session, current_user: User, search: str | None) -> list[User]:
    query = select(User).where(User.id != current_user.id, User.active.is_(True)).order_by(User.full_name)
    if search:
        like = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(like), User.department.ilike(like), User.secretariat.ilike(like)))
    return list(db.scalars(query.limit(20)))


def get_contact(db: Session, current_user: User, contact_id: int) -> User | None:
    if contact_id == current_user.id:
        return None
    contact = db.get(User, contact_id)
    return contact if contact and contact.active else None


def _conversation_partner_ids(db: Session, user_id: int) -> list[int]:
    sent_to = select(ChatMessage.recipient_id).where(ChatMessage.sender_id == user_id)
    received_from = select(ChatMessage.sender_id).where(ChatMessage.recipient_id == user_id)
    return list(db.scalars(sent_to.union(received_from)))


def list_conversations(db: Session, current_user: User) -> list[ConversationSummary]:
    partner_ids = _conversation_partner_ids(db, current_user.id)
    if not partner_ids:
        return []
    partners = {user.id: user for user in db.scalars(select(User).where(User.id.in_(partner_ids)))}

    summaries: list[ConversationSummary] = []
    for partner_id in partner_ids:
        partner = partners.get(partner_id)
        if not partner:
            continue
        last_message = db.scalar(
            select(ChatMessage)
            .where(_conversation_conditions(current_user.id, partner_id))
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        unread = db.scalar(
            select(func.count(ChatMessage.id)).where(
                ChatMessage.sender_id == partner_id,
                ChatMessage.recipient_id == current_user.id,
                ChatMessage.read_at.is_(None),
            )
        ) or 0
        summaries.append(ConversationSummary(contact=partner, last_message=last_message, unread_count=unread))

    summaries.sort(key=lambda item: item.last_message.created_at if item.last_message else utc_now(), reverse=True)
    return summaries


def get_messages(db: Session, current_user: User, partner_id: int, after_id: int | None) -> list[ChatMessage]:
    query = select(ChatMessage).where(_conversation_conditions(current_user.id, partner_id))
    if after_id is not None:
        return list(db.scalars(query.where(ChatMessage.id > after_id).order_by(ChatMessage.created_at.asc())))
    messages = list(db.scalars(query.order_by(ChatMessage.created_at.desc()).limit(MESSAGE_PAGE_SIZE)))
    messages.reverse()
    return messages


def send_message(db: Session, current_user: User, recipient: User, body: str) -> ChatMessage:
    message = ChatMessage(sender_id=current_user.id, recipient_id=recipient.id, body=body.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def mark_conversation_read(db: Session, current_user: User, partner_id: int) -> None:
    db.execute(
        update(ChatMessage)
        .where(
            ChatMessage.sender_id == partner_id,
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.read_at.is_(None),
        )
        .values(read_at=utc_now())
    )
    db.commit()


def unread_count(db: Session, current_user: User) -> int:
    return db.scalar(
        select(func.count(ChatMessage.id)).where(
            ChatMessage.recipient_id == current_user.id,
            ChatMessage.read_at.is_(None),
        )
    ) or 0
