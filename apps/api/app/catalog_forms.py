from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import EmailStr, TypeAdapter, ValidationError

from .models import ServiceCatalog

EMAIL_ADAPTER = TypeAdapter(EmailStr)

FIELD_DEFINITIONS: dict[str, dict[str, Any]] = {
    "local": {
        "label": "Local",
        "type": "text",
        "required": True,
        "placeholder": "Informe o prédio, unidade ou sala",
        "max_length": 160,
    },
    "location": {
        "label": "Localização",
        "type": "text",
        "required": True,
        "placeholder": "Informe onde ocorre o atendimento",
        "max_length": 160,
    },
    "computer": {
        "label": "Computador",
        "type": "text",
        "required": False,
        "placeholder": "Nome ou patrimônio do computador",
        "max_length": 160,
    },
    "printer_model": {
        "label": "Modelo da impressora",
        "type": "text",
        "required": False,
        "placeholder": "Ex.: Brother DCP-L2540DW",
        "max_length": 160,
    },
    "printer_ip": {
        "label": "IP da impressora",
        "type": "text",
        "required": False,
        "placeholder": "Ex.: 192.168.1.20",
        "max_length": 60,
    },
    "email_account": {
        "label": "Conta de e-mail",
        "type": "email",
        "required": True,
        "placeholder": "nome@secretaria.cabofrio.rj.gov.br",
        "max_length": 180,
    },
    "error_message": {
        "label": "Mensagem de erro",
        "type": "textarea",
        "required": False,
        "placeholder": "Transcreva a mensagem apresentada, se houver",
        "max_length": 1000,
    },
    "person_name": {
        "label": "Nome da pessoa",
        "type": "text",
        "required": True,
        "placeholder": "Nome completo",
        "max_length": 180,
    },
    "cpf": {
        "label": "CPF",
        "type": "text",
        "required": False,
        "placeholder": "Somente números ou formato 000.000.000-00",
        "max_length": 14,
    },
    "requested_action": {
        "label": "Ação solicitada",
        "type": "select",
        "required": True,
        "options": ["Criar", "Alterar", "Excluir", "Desbloquear"],
    },
    "authorization": {
        "label": "Autorização",
        "type": "textarea",
        "required": False,
        "placeholder": "Informe o responsável que autorizou a solicitação",
        "max_length": 1000,
    },
    "username": {
        "label": "Nome de usuário",
        "type": "text",
        "required": True,
        "placeholder": "Usuário de rede ou matrícula",
        "max_length": 120,
    },
    "department": {
        "label": "Setor",
        "type": "text",
        "required": True,
        "placeholder": "Secretaria e setor do usuário",
        "max_length": 160,
    },
    "symptoms": {
        "label": "Sintomas",
        "type": "textarea",
        "required": True,
        "placeholder": "Descreva os sinais apresentados pelo equipamento",
        "max_length": 2000,
    },
    "started_at": {
        "label": "Início do problema",
        "type": "date",
        "required": False,
    },
    "scope": {
        "label": "Abrangência",
        "type": "select",
        "required": True,
        "options": ["Somente meu computador", "Alguns usuários", "Todo o setor", "Mais de um setor"],
    },
    "responsible_user": {
        "label": "Usuário responsável",
        "type": "text",
        "required": True,
        "placeholder": "Nome de quem utilizará o equipamento",
        "max_length": 180,
    },
    "network_point": {
        "label": "Ponto de rede",
        "type": "text",
        "required": False,
        "placeholder": "Identificação do ponto, se conhecida",
        "max_length": 120,
    },
    "software_name": {
        "label": "Nome do sistema",
        "type": "text",
        "required": True,
        "placeholder": "Nome e versão, se conhecida",
        "max_length": 180,
    },
    "license": {
        "label": "Licença",
        "type": "select",
        "required": False,
        "options": ["Já disponível", "Precisa ser verificada", "Não sei informar"],
    },
    "details": {
        "label": "Detalhes",
        "type": "textarea",
        "required": False,
        "placeholder": "Inclua informações específicas deste serviço",
        "max_length": 2000,
    },
}

ALLOWED_FIELD_TYPES = {"text", "email", "textarea", "select", "date"}


def normalize_form_schema(schema: dict[str, Any] | None) -> dict[str, Any]:
    raw_fields = (schema or {}).get("fields", [])
    normalized: list[dict[str, Any]] = []

    for item in raw_fields:
        if isinstance(item, str):
            key = item
            overrides: dict[str, Any] = {}
        elif isinstance(item, dict):
            key = str(item.get("key") or item.get("name") or item.get("id") or "").strip()
            overrides = item
        else:
            continue

        if not key:
            continue

        definition = {
            "key": key,
            "label": key.replace("_", " ").title(),
            "type": "text",
            "required": False,
            "placeholder": "",
            "options": [],
            "max_length": 500,
            **FIELD_DEFINITIONS.get(key, {}),
        }
        for property_name in ("label", "type", "required", "placeholder", "options", "max_length"):
            if property_name in overrides:
                definition[property_name] = overrides[property_name]

        if definition["type"] not in ALLOWED_FIELD_TYPES:
            definition["type"] = "text"
        definition["required"] = bool(definition["required"])
        raw_options = definition.get("options", [])
        definition["options"] = [str(option) for option in raw_options] if isinstance(raw_options, list) else []
        try:
            max_length = int(definition.get("max_length") or 500)
        except (TypeError, ValueError):
            max_length = 500
        definition["max_length"] = max(1, min(max_length, 5000))
        normalized.append(definition)

    return {"fields": normalized}


def validate_form_data(schema: dict[str, Any] | None, values: dict[str, Any] | None) -> dict[str, str]:
    normalized = normalize_form_schema(schema)
    provided = values or {}
    if not isinstance(provided, dict):
        raise ValueError("Os campos adicionais devem ser enviados como objeto.")

    fields = {field["key"]: field for field in normalized["fields"]}
    unknown = sorted(set(provided) - set(fields))
    if unknown:
        raise ValueError(f"Campo adicional não permitido: {unknown[0]}.")

    cleaned: dict[str, str] = {}
    for key, field in fields.items():
        raw_value = provided.get(key, "")
        value = str(raw_value).strip() if raw_value is not None else ""

        if field["required"] and not value:
            raise ValueError(f'Preencha o campo "{field["label"]}".')
        if not value:
            continue
        if len(value) > field["max_length"]:
            raise ValueError(f'O campo "{field["label"]}" excede o limite permitido.')
        if field["type"] == "select" and field["options"] and value not in field["options"]:
            raise ValueError(f'Valor inválido para o campo "{field["label"]}".')
        if field["type"] == "email":
            try:
                EMAIL_ADAPTER.validate_python(value)
            except ValidationError as exc:
                raise ValueError(f'Informe um e-mail válido no campo "{field["label"]}".') from exc
        if field["type"] == "date":
            try:
                date.fromisoformat(value)
            except ValueError as exc:
                raise ValueError(f'Informe uma data válida no campo "{field["label"]}".') from exc
        cleaned[key] = value

    return cleaned


def catalog_payload(service: ServiceCatalog) -> dict[str, Any]:
    return {
        "id": service.id,
        "name": service.name,
        "category": service.category,
        "description": service.description,
        "icon": service.icon,
        "color": service.color,
        "active": service.active,
        "form_schema": normalize_form_schema(service.form_schema),
    }
