from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import (
    ChatContactOut,
    ChatConversationOut,
    ChatMessageCreate,
    ChatMessageOut,
    ChatUnreadCountOut,
    MessageOut,
)
from ..services import chat_service

router = APIRouter(prefix="/api/chat", tags=["mensagens"])


@router.get("/contacts", response_model=list[ChatContactOut])
def list_contacts(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return chat_service.search_contacts(db, current_user, search)


@router.get("/conversations", response_model=list[ChatConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    summaries = chat_service.list_conversations(db, current_user)
    return [
        ChatConversationOut(contact=item.contact, last_message=item.last_message, unread_count=item.unread_count)
        for item in summaries
    ]


@router.get("/unread-count", response_model=ChatUnreadCountOut)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return ChatUnreadCountOut(unread_count=chat_service.unread_count(db, current_user))


@router.get("/messages/{contact_id}", response_model=list[ChatMessageOut])
def list_messages(
    contact_id: int,
    after_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = chat_service.get_contact(db, current_user, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    return chat_service.get_messages(db, current_user, contact_id, after_id)


@router.post("/messages", response_model=ChatMessageOut, status_code=201)
def create_message(
    payload: ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recipient = chat_service.get_contact(db, current_user, payload.recipient_id)
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinatário não encontrado")
    body = payload.body.strip()
    if not body:
        raise HTTPException(status_code=422, detail="A mensagem não pode ficar vazia")
    return chat_service.send_message(db, current_user, recipient, body)


@router.post("/messages/{contact_id}/read", response_model=MessageOut)
def mark_read(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contact = chat_service.get_contact(db, current_user, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    chat_service.mark_conversation_read(db, current_user, contact_id)
    return MessageOut(message="Conversa marcada como lida")
