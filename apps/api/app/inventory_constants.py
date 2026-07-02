DEFAULT_INVENTORY_SECTOR = "ADCETEI"

INVENTORY_STATUSES = ("stock", "allocated", "maintenance", "retired")

INVENTORY_MOVEMENT_ACTIONS = (
    "created",
    "updated",
    "allocated",
    "responsible_changed",
    "returned_to_stock",
    "maintenance",
)

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
