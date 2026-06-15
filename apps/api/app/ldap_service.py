"""Integração LDAP/Active Directory opcional.

O protótipo roda em AUTH_MODE=local. Em `ldap` ou `hybrid`, este módulo valida
as credenciais no AD e provisiona o usuário no banco local.
"""
from dataclasses import dataclass

from ldap3 import ALL, Connection, Server, SUBTREE
from ldap3.utils.conv import escape_filter_chars
from ldap3.utils.dn import parse_dn

from .config import settings


@dataclass
class LDAPUser:
    username: str
    full_name: str
    email: str
    department: str
    secretariat: str
    phone: str
    groups: list[str]


def authenticate_ldap(username: str, password: str) -> LDAPUser | None:
    if not all([settings.ldap_server, settings.ldap_bind_dn, settings.ldap_base_dn, settings.ldap_user_filter]):
        return None

    server = Server(settings.ldap_server, get_info=ALL)
    service = Connection(
        server,
        user=settings.ldap_bind_dn,
        password=settings.ldap_bind_password,
        auto_bind=True,
    )
    search_filter = settings.ldap_user_filter.format(username=escape_filter_chars(username))
    service.search(
        settings.ldap_base_dn,
        search_filter,
        search_scope=SUBTREE,
        attributes=[
            "distinguishedName",
            "displayName",
            "mail",
            "department",
            "company",
            "telephoneNumber",
            "memberOf",
            "sAMAccountName",
        ],
    )
    if not service.entries:
        return None

    entry = service.entries[0]
    user_dn = str(entry.distinguishedName)
    user_conn = Connection(server, user=user_dn, password=password, auto_bind=True)
    if not user_conn.bound:
        return None

    groups = [str(group) for group in getattr(entry, "memberOf", [])]
    return LDAPUser(
        username=username,
        full_name=str(getattr(entry, "displayName", username)),
        email=str(getattr(entry, "mail", f"{username}@cabofrio.rj.gov.br")),
        department=str(getattr(entry, "department", "Não informado")),
        secretariat=str(getattr(entry, "company", "Prefeitura de Cabo Frio")),
        phone=str(getattr(entry, "telephoneNumber", "")),
        groups=groups,
    )


def role_from_groups(groups: list[str], mappings: dict[str, str] | None = None) -> str:
    group_names: set[str] = set()
    for group_dn in groups:
        try:
            components = parse_dn(group_dn, escape=True)
            if components and components[0][0].casefold() == "cn":
                group_names.add(str(components[0][1]).casefold())
        except (TypeError, ValueError):
            continue

    configured = mappings or {
        settings.ldap_admin_group.casefold(): "admin",
        settings.ldap_helpdesk_group.casefold(): "helpdesk",
        settings.ldap_technician_group.casefold(): "technician",
    }
    for group_name, role in configured.items():
        if group_name and group_name.casefold() in group_names:
            return role
    return "requester"
