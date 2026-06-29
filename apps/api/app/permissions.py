from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import RoleConfig, User

PERMISSION_DEFINITIONS = [
    {"key": "tickets.view_all", "label": "Ver todos os chamados", "group": "Chamados"},
    {"key": "tickets.triage", "label": "Fazer triagem e alterar dados administrativos", "group": "Chamados"},
    {"key": "tickets.internal_notes", "label": "Criar e visualizar notas internas", "group": "Chamados"},
    {"key": "users.view", "label": "Consultar usuários", "group": "Administração"},
    {"key": "users.manage", "label": "Criar, editar e bloquear usuários", "group": "Administração"},
    {"key": "catalog.manage", "label": "Gerenciar catálogo e formulários", "group": "Administração"},
    {"key": "assets.view", "label": "Consultar inventário completo", "group": "Inventário"},
    {"key": "assets.manage", "label": "Cadastrar e editar equipamentos", "group": "Inventário"},
    {"key": "printers.view", "label": "Consultar impressoras e status CUPS", "group": "Impressoras"},
    {"key": "printers.jobs.view", "label": "Consultar jobs de impressão pendentes", "group": "Impressoras"},
    {"key": "printers.manage", "label": "Gerenciar filas de impressão", "group": "Impressoras"},
    {"key": "roles.manage", "label": "Configurar perfis e permissões", "group": "Segurança"},
    {"key": "audit.view", "label": "Consultar auditoria administrativa", "group": "Segurança"},
]

ALL_PERMISSIONS = {item["key"] for item in PERMISSION_DEFINITIONS}

PERMISSION_DEPENDENCIES = {
    "tickets.triage": {"tickets.view_all", "users.view", "assets.view"},
    "users.manage": {"users.view"},
    "assets.manage": {"assets.view"},
    "printers.jobs.view": {"printers.view"},
    "printers.manage": {"printers.view", "printers.jobs.view"},
}

DEFAULT_ROLE_CONFIGS = {
    "admin": {
        "label": "Administrador",
        "description": "Acesso completo à operação e às configurações do portal.",
        "ldap_group": "",
        "permissions": sorted(ALL_PERMISSIONS),
    },
    "helpdesk": {
        "label": "Helpdesk",
        "description": "Triagem, distribuição e acompanhamento geral dos chamados.",
        "ldap_group": "",
        "permissions": [
            "tickets.view_all",
            "tickets.triage",
            "tickets.internal_notes",
            "users.view",
            "assets.view",
            "printers.view",
            "printers.jobs.view",
        ],
    },
    "technician": {
        "label": "Técnico",
        "description": "Atendimento dos chamados atribuídos e consulta técnica.",
        "ldap_group": "",
        "permissions": ["tickets.internal_notes", "assets.view", "printers.view", "printers.jobs.view"],
    },
    "requester": {
        "label": "Solicitante",
        "description": "Abertura e acompanhamento dos próprios chamados.",
        "ldap_group": "",
        "permissions": ["printers.view"],
    },
}


def ensure_role_configs(db: Session) -> None:
    existing = set(db.scalars(select(RoleConfig.role)))
    for role, data in DEFAULT_ROLE_CONFIGS.items():
        if role not in existing:
            db.add(RoleConfig(role=role, **data))
        else:
            config = db.get(RoleConfig, role)
            if config and role != "admin":
                permissions = set(config.permissions or [])
                defaults = set(data["permissions"])
                if not defaults.issubset(permissions):
                    config.permissions = normalize_permissions(permissions | defaults)
    db.commit()


def permissions_for_role(db: Session, role: str) -> set[str]:
    if role == "admin":
        return set(ALL_PERMISSIONS)
    config = db.get(RoleConfig, role)
    if not config:
        return set(normalize_permissions(DEFAULT_ROLE_CONFIGS.get(role, {}).get("permissions", [])))
    return set(normalize_permissions(config.permissions or []))


def normalize_permissions(permissions: list[str] | set[str]) -> list[str]:
    normalized = set(permissions).intersection(ALL_PERMISSIONS)
    changed = True
    while changed:
        changed = False
        for permission in tuple(normalized):
            dependencies = PERMISSION_DEPENDENCIES.get(permission, set())
            if not dependencies.issubset(normalized):
                normalized.update(dependencies)
                changed = True
    return sorted(normalized)


def has_permission(db: Session, user: User, permission: str) -> bool:
    return permission in permissions_for_role(db, user.role)


def require_permission(permission: str):
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not has_permission(db, current_user, permission):
            raise HTTPException(status_code=403, detail="Seu perfil não possui permissão para esta ação")
        return current_user

    return checker
