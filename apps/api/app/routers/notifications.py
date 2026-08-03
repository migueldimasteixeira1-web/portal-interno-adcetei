from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User
from ..schemas import (
    MessageOut,
    NotificationOut,
    NotificationPreferencesOut,
    NotificationPreferencesUpdate,
    NotificationUnreadCountOut,
)
from ..services import notifications_service

router = APIRouter(prefix="/api/notifications", tags=["notificacoes"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notifications_service.list_notifications(db, current_user)


@router.get("/unread-count", response_model=NotificationUnreadCountOut)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return NotificationUnreadCountOut(unread_count=notifications_service.unread_count(db, current_user))


@router.post("/{notification_id}/read", response_model=MessageOut)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not notifications_service.mark_read(db, current_user, notification_id):
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return MessageOut(message="Notificação marcada como lida")


@router.post("/read-all", response_model=MessageOut)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications_service.mark_all_read(db, current_user)
    return MessageOut(message="Notificações marcadas como lidas")


@router.get("/preferences", response_model=NotificationPreferencesOut)
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notifications_service.get_preferences(db, current_user)


@router.patch("/preferences", response_model=NotificationPreferencesOut)
def update_preferences(
    payload: NotificationPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notifications_service.update_preferences(
        db,
        current_user,
        payload.master_muted,
        payload.voice_muted,
        payload.standard_sound_muted,
    )
