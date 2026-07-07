DEFAULT_INVENTORY_SECTOR = "ADCETEI"

INVENTORY_STATUSES = ("stock", "allocated", "maintenance", "retired")

INVENTORY_MOVEMENT_ACTIONS = (
    "created",
    "updated",
    "allocated",
    "responsible_changed",
    "returned_to_stock",
    "maintenance",
    "retired",
)

INVENTORY_RETIREMENT_REASONS = (
    "CONTRATO_ENCERRADO",
    "DEVOLVIDO_AO_FORNECEDOR",
    "DEFEITO_IRRECUPERAVEL",
    "DESCARTE",
    "SUBSTITUICAO",
    "PERDA",
    "FURTO_ROUBO",
    "CORRECAO_ADMINISTRATIVA",
    "OUTRO",
)

INVENTORY_RETIREMENT_REASON_LABELS = {
    "CONTRATO_ENCERRADO": "Contrato encerrado",
    "DEVOLVIDO_AO_FORNECEDOR": "Devolvido ao fornecedor",
    "DEFEITO_IRRECUPERAVEL": "Defeito sem recuperação",
    "DESCARTE": "Descarte",
    "SUBSTITUICAO": "Substituição",
    "PERDA": "Perda",
    "FURTO_ROUBO": "Furto/Roubo",
    "CORRECAO_ADMINISTRATIVA": "Correção administrativa",
    "OUTRO": "Outro",
}

INVENTORY_PERMISSIONS = (
    "inventory.view",
    "inventory.create",
    "inventory.bulk_scan",
    "inventory.import",
    "inventory.move",
    "inventory.edit",
    "inventory.manage_catalogs",
    "inventory.audit",
)
