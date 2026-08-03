#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
API_PYTHON="$ROOT_DIR/apps/api/.venv/bin/python"
TEST_DB="$(mktemp /tmp/portal-notifications-XXXX.db)"

cleanup() {
  rm -f "$TEST_DB"
}
trap cleanup EXIT

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

cd "$ROOT_DIR"
(cd "$API_DIR" && DATABASE_URL="sqlite:///$TEST_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" -m alembic upgrade head)
DATABASE_URL="sqlite:///$TEST_DB" ENVIRONMENT=test SECRET_KEY="chave-local-para-notificacoes" "$API_PYTHON" - <<'PY'
from apps.api.app.auth import hash_password
from apps.api.app.database import SessionLocal
from apps.api.app.models import Notification, ServiceCatalog, User
from apps.api.app.permissions import ensure_role_configs
from apps.api.app.routers.tickets import add_comment, create_ticket, update_ticket
from apps.api.app.schemas import CommentCreate, TicketCreate, TicketUpdate
from apps.api.app.services import notifications_service
from apps.api.app.time_utils import utc_now

with SessionLocal() as db:
    ensure_role_configs(db)
    admin = User(
        username="admin",
        full_name="Admin Teste",
        email="admin@adcetei.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="admin",
        active=True,
        email_verified_at=utc_now(),
    )
    technician = User(
        username="tecnico",
        full_name="Técnico Teste",
        email="tecnico@adcetei.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="technician",
        active=True,
        email_verified_at=utc_now(),
    )
    requester = User(
        username="solicitante",
        full_name="Solicitante Teste",
        email="solicitante@adcetei.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="user",
        active=True,
        email_verified_at=utc_now(),
    )
    service = ServiceCatalog(name="Suporte Genérico", category="Suporte", active=True, form_schema={})
    db.add_all([admin, technician, requester, service])
    db.commit()

    def notifications_for(user) -> list[Notification]:
        return notifications_service.list_notifications(db, user)

    def latest(user) -> Notification:
        items = notifications_for(user)
        assert items, f"Nenhuma notificação para {user.username}"
        return items[0]

    # 1) Novo chamado: fica de fora quem abriu, e vai para quem tem tickets.view_all (voz).
    ticket = create_ticket(
        TicketCreate(description="Impressora não liga.", service_id=service.id),
        db,
        requester,
    )
    ticket_id = ticket["id"]
    assert not notifications_for(requester), "Solicitante não deve ser notificado do próprio chamado aberto"
    created_notification = latest(technician)
    assert created_notification.event_type == "ticket_created"
    assert created_notification.sound_kind == "voice"
    assert created_notification.read_at is None
    admin_created_notification = latest(admin)
    assert admin_created_notification.event_type == "ticket_created"

    # 2) Atribuição: assignee recebe notificação padrão; quem atribuiu (admin) não recebe.
    update_ticket(ticket_id, TicketUpdate(assignee_id=technician.id), db, admin)
    assignment_notifications = [item for item in notifications_for(technician) if item.event_type == "ticket_assigned"]
    assert len(assignment_notifications) == 1
    assert assignment_notifications[0].sound_kind == "standard"
    assert not any(item.event_type == "ticket_assigned" for item in notifications_for(admin))
    # a atribuição também disparou "new" -> "assigned": o solicitante deve ser avisado da mudança de status.
    assert any(item.event_type == "ticket_status_changed" for item in notifications_for(requester))

    # 3) Mudança de status pelo técnico responsável: solicitante é avisado, o próprio técnico não.
    before_status_count = len(notifications_for(requester))
    before_tech_status_count = len(notifications_for(technician))
    update_ticket(ticket_id, TicketUpdate(status="waiting_requester"), db, technician)
    requester_notifications = notifications_for(requester)
    assert len(requester_notifications) == before_status_count + 1
    assert requester_notifications[0].event_type == "ticket_status_changed"
    assert len(notifications_for(technician)) == before_tech_status_count, "Técnico não deve se autonotificar"

    # 4) Comentário do solicitante: notifica o técnico responsável, não o próprio solicitante.
    before_tech_count = len(notifications_for(technician))
    comment = add_comment(ticket_id, CommentCreate(body="Já tentei reiniciar e continua sem funcionar."), db, requester)
    tech_notifications = notifications_for(technician)
    assert len(tech_notifications) == before_tech_count + 1
    assert tech_notifications[0].event_type == "ticket_comment"

    # 5) Comentário do técnico: notifica o solicitante.
    before_req_count = len(notifications_for(requester))
    add_comment(ticket_id, CommentCreate(body="Pode tentar trocar o cabo de energia?"), db, technician)
    assert len(notifications_for(requester)) == before_req_count + 1

    # 6) Nota interna do técnico responsável não gera notificação (nem para ele, nem para o solicitante).
    before_req_internal = len(notifications_for(requester))
    add_comment(ticket_id, CommentCreate(body="Nota interna: aguardando peça.", internal=True), db, technician)
    assert len(notifications_for(requester)) == before_req_internal

    # 7) Nota interna de outro membro da equipe (admin) notifica o técnico responsável.
    before_tech_internal = len(notifications_for(technician))
    add_comment(ticket_id, CommentCreate(body="Nota interna do admin.", internal=True), db, admin)
    assert len(notifications_for(technician)) == before_tech_internal + 1

    # 8) Contagem de não lidas, marcar uma como lida, marcar todas como lidas.
    unread_before = notifications_service.unread_count(db, technician)
    assert unread_before > 0
    target = notifications_for(technician)[0]
    assert notifications_service.mark_read(db, technician, target.id)
    assert notifications_service.unread_count(db, technician) == unread_before - 1
    assert not notifications_service.mark_read(db, requester, target.id), "Usuário não pode marcar notificação alheia como lida"
    notifications_service.mark_all_read(db, technician)
    assert notifications_service.unread_count(db, technician) == 0

    # 9) Preferências: padrão tudo habilitado (nenhum mute), e atualização parcial funciona.
    preferences = notifications_service.get_preferences(db, requester)
    assert preferences.master_muted is False
    assert preferences.voice_muted is False
    assert preferences.standard_sound_muted is False
    updated = notifications_service.update_preferences(db, requester, None, True, None)
    assert updated.voice_muted is True
    assert updated.master_muted is False
    assert updated.standard_sound_muted is False

print("Notificações in-app: OK")
PY
