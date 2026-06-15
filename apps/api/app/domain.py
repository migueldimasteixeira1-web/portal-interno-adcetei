from typing import Literal, TypeAlias

TicketStatus: TypeAlias = Literal[
    "new",
    "triage",
    "assigned",
    "in_progress",
    "waiting_user",
    "waiting_tech",
    "resolved",
    "closed",
    "cancelled",
]

TicketPriority: TypeAlias = Literal["low", "medium", "high", "critical"]

STATUS_LABELS = {
    "new": "Novo",
    "triage": "Em triagem",
    "assigned": "Atribuído",
    "in_progress": "Em atendimento",
    "waiting_user": "Aguardando solicitante",
    "waiting_tech": "Aguardando técnico",
    "resolved": "Resolvido",
    "closed": "Fechado",
    "cancelled": "Cancelado",
}

PRIORITY_LABELS = {
    "low": "Baixa",
    "medium": "Média",
    "high": "Alta",
    "critical": "Crítica",
}

OPEN_STATUSES = (
    "new",
    "triage",
    "assigned",
    "in_progress",
    "waiting_user",
    "waiting_tech",
)

TECHNICIAN_STATUSES = {
    "in_progress",
    "waiting_user",
    "waiting_tech",
    "resolved",
}
