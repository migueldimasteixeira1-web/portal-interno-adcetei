from typing import Literal, TypeAlias

TicketStatus: TypeAlias = Literal[
    "new",
    "assigned",
    "closed",
    "cancelled",
]

TicketPriority: TypeAlias = Literal["low", "medium", "high", "critical"]

STATUS_LABELS = {
    "new": "Novo",
    "assigned": "Atribuído",
    "closed": "Fechado",
    "cancelled": "Cancelado",
}

TICKET_STATUSES = tuple(STATUS_LABELS)

PRIORITY_LABELS = {
    "low": "Baixa",
    "medium": "Média",
    "high": "Alta",
    "critical": "Crítica",
}

OPEN_STATUSES = (
    "new",
    "assigned",
)

TECHNICIAN_STATUSES = {
    "assigned",
    "closed",
    "cancelled",
}
