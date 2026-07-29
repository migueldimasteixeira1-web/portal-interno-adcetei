from typing import Literal, TypeAlias

TicketStatus: TypeAlias = Literal[
    "new",
    "assigned",
    "in_progress",
    "waiting_requester",
    "resolved",
    "closed",
    "cancelled",
]

TicketPriority: TypeAlias = Literal["low", "medium", "high", "critical"]

STATUS_LABELS = {
    "new": "Novo",
    "assigned": "Atribuído",
    "in_progress": "Em andamento",
    "waiting_requester": "Aguardando solicitante",
    "resolved": "Resolvido",
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

# Chamado ainda em aberto, no sentido de que segue na fila de algum responsável.
OPEN_STATUSES = (
    "new",
    "assigned",
    "in_progress",
    "waiting_requester",
)

# "waiting_requester" pausa a cobrança de prazo: o atendimento está travado por
# dependência do solicitante, não do técnico.
OVERDUE_ELIGIBLE_STATUSES = (
    "new",
    "assigned",
    "in_progress",
)

TECHNICIAN_STATUSES = {
    "assigned",
    "in_progress",
    "waiting_requester",
    "resolved",
    "closed",
    "cancelled",
}

# Estados a partir dos quais um chamado pode ser reaberto.
REOPENABLE_STATUSES = {
    "resolved",
    "closed",
    "cancelled",
}

# Janela, em dias a partir do encerramento, em que "closed"/"cancelled" ainda
# podem ser reabertos. "resolved" nunca é terminal, então não tem janela.
REOPEN_WINDOW_DAYS = 7
