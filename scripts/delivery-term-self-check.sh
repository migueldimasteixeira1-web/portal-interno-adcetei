#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PYTHON="$ROOT_DIR/apps/api/.venv/bin/python"
TEST_DB="$(mktemp /tmp/portal-delivery-term-XXXX.db)"

cleanup() {
  rm -f "$TEST_DB"
}
trap cleanup EXIT

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

cd "$ROOT_DIR"
DATABASE_URL="sqlite:///$TEST_DB" ENVIRONMENT=test SECRET_KEY="chave-local-para-termos" "$API_PYTHON" - <<'PY'
from datetime import date, datetime, timezone
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from fastapi import HTTPException
from sqlalchemy import select

from apps.api.app.auth import hash_password
from apps.api.app.database import Base, SessionLocal, engine, ensure_schema_compatibility
from apps.api.app.delivery_terms_docx import render_delivery_term_docx, term_filename
from apps.api.app.models import Asset, InventoryContract, InventoryDeliveryTerm, InventoryDeliveryTermItem, InventoryEquipmentModel, InventoryEquipmentType, InventoryManufacturer, InventorySecretariat, InventorySector, InventorySupplier, User
from apps.api.app.permissions import ensure_role_configs
from apps.api.app.routers.admin.assets import delete_asset as delete_admin_asset
from apps.api.app.routers.admin.users import delete_user
from apps.api.app.routers.inventory.assets import allocate_inventory_asset, delete_inventory_asset, retire_inventory_asset
from apps.api.app.routers.inventory.catalogs import delete_sector
from apps.api.app.routers.inventory.terms import cancel_delivery_term, confirm_delivery_term, create_delivery_term, next_term_number, preview_delivery_term
from apps.api.app.schemas import InventoryAllocateRequest, InventoryDeliveryTermCreate, InventoryDeliveryTermDeliver, InventoryDeliveryTermPreview, InventoryRetireRequest
from apps.api.app.time_utils import utc_now

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()


def expect_conflict(action, message: str) -> None:
    try:
        action()
    except HTTPException as exc:
        assert exc.status_code == 409, exc.detail
        assert message in str(exc.detail), exc.detail
    else:
        raise AssertionError(f"Conflito esperado: {message}")

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
    recipient = User(
        username="erica",
        full_name="Érica Sanches",
        email="erica.sanches@adppe.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="user",
        active=False,
        secretariat="Secretaria de Governo e Integridade",
        department="ADCETEI",
        registration="",
        phone="",
    )
    empty_recipient = User(
        username="sem.dados",
        full_name="Recebedor Sem Dados",
        email="sem.dados@adcetei.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="user",
        active=False,
        secretariat="Secretaria de Governo e Integridade",
        department="ADCETEI",
        registration="",
        phone="",
    )
    supplier = InventorySupplier(name="Fornecedor", normalized_name="fornecedor")
    equipment_type = InventoryEquipmentType(name="Monitor", normalized_name="monitor")
    manufacturer = InventoryManufacturer(name="Samsung", normalized_name="samsung")
    secretariat = db.scalar(select(InventorySecretariat).where(InventorySecretariat.normalized_name == "secretaria de governo e integridade"))
    db.add_all([admin, recipient, empty_recipient, supplier, equipment_type, manufacturer])
    db.flush()
    sector = db.scalar(select(InventorySector).where(InventorySector.normalized_name == "adcetei"))
    alternate_sector = InventorySector(name="Destino Alternativo", normalized_name="destino alternativo", secretariat_id=secretariat.id)
    db.add(alternate_sector)
    db.flush()
    recipient.department_sector_id = sector.id
    empty_recipient.department_sector_id = sector.id
    contract = InventoryContract(
        name="Contrato nº 046/2026 – PMCF / IART",
        normalized_name="contrato-046-2026-pmcf-iart",
        supplier_id=supplier.id,
    )
    model = InventoryEquipmentModel(
        name="S24D400GAL",
        normalized_name="s24d400gal",
        manufacturer_id=manufacturer.id,
        equipment_type_id=equipment_type.id,
    )
    db.add_all([contract, model])
    db.flush()
    asset = Asset(
        name="Monitor Samsung S24D400GAL",
        asset_type="Monitor",
        manufacturer="Samsung",
        model="S24D400GAL",
        serial_number="Y5UJHX5YA00227V",
        specifications="Monitor 24 polegadas, resolução Full HD",
        status="stock",
        location="ADCETEI",
        supplier_id=supplier.id,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=model.id,
        sector_id=sector.id,
        received_at=datetime(2026, 7, 7, 12, tzinfo=timezone.utc),
    )
    empty_asset = Asset(
        name="Monitor Samsung S24D400GAL",
        asset_type="Monitor",
        manufacturer="Samsung",
        model="S24D400GAL",
        serial_number="Y5UJHX5YA00228V",
        specifications="Monitor 24 polegadas, resolução Full HD",
        status="stock",
        location="ADCETEI",
        supplier_id=supplier.id,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=model.id,
        sector_id=sector.id,
        received_at=datetime(2026, 7, 10, 12, tzinfo=timezone.utc),
    )
    allocated_asset = Asset(name="Alocado", asset_type="Monitor", serial_number="STATUS-ALLOCATED", status="active", sector_id=sector.id)
    maintenance_asset = Asset(name="Manutenção", asset_type="Monitor", serial_number="STATUS-MAINTENANCE", status="maintenance", sector_id=sector.id)
    retired_asset = Asset(name="Baixado", asset_type="Monitor", serial_number="STATUS-RETIRED", status="retired", sector_id=sector.id)
    atomic_asset_a = Asset(name="Atômico A", asset_type="Monitor", serial_number="ATOMIC-A", status="stock", sector_id=sector.id, received_at=datetime(2026, 7, 7, 12, tzinfo=timezone.utc))
    atomic_asset_b = Asset(name="Atômico B", asset_type="Monitor", serial_number="ATOMIC-B", status="stock", sector_id=sector.id, received_at=datetime(2026, 7, 7, 12, tzinfo=timezone.utc))
    db.add_all([asset, empty_asset, allocated_asset, maintenance_asset, retired_asset, atomic_asset_a, atomic_asset_b])
    db.commit()

    preview = preview_delivery_term(InventoryDeliveryTermPreview(serial_numbers=["Y5UJHX5YA00227V", "Y5UJHX5YA00227V", "NAO-EXISTE"]), db, admin)
    assert preview["valid_count"] == 1
    assert preview["invalid_count"] == 2
    assert "Monitor 24 polegadas" in preview["valid_items"][0]["specification"]
    for serial, expected in (
        ("STATUS-ALLOCATED", "estoque"),
        ("STATUS-MAINTENANCE", "estoque"),
        ("STATUS-RETIRED", "baixado"),
    ):
        rejected = preview_delivery_term(InventoryDeliveryTermPreview(serial_numbers=[serial]), db, admin)
        assert rejected["valid_count"] == 0
        assert expected in rejected["errors"][0]["message"].lower()

    cancellable = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="001/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Texto informado pelo cliente deve ser ignorado",
            recipient_user_id=recipient.id,
            recipient_registration="250401573",
            recipient_phone="22-981221739",
            adcetei_signer_name="William Barreto Corrêa",
            adcetei_signer_title="Coordenador Geral de Tecnologia da Informação",
            item_observation="Equipamento locado",
            serial_numbers=["Y5UJHX5YA00227V"],
        ),
        db,
        admin,
    )
    assert next_term_number(db) == "002/2026"
    expect_conflict(
        lambda: allocate_inventory_asset(
            asset.id,
            InventoryAllocateRequest(sector_id=sector.id, assigned_user_id=None, movement_date=date(2026, 7, 9)),
            db,
            admin,
        ),
        "termo aberto 001/2026",
    )
    expect_conflict(
        lambda: retire_inventory_asset(
            asset.id,
            InventoryRetireRequest(reason="SUBSTITUICAO", justification="Equipamento reservado para entrega.", movement_date=date(2026, 7, 9)),
            db,
            admin,
        ),
        "termo aberto 001/2026",
    )
    cancelled = cancel_delivery_term(cancellable["id"], db, admin)
    assert cancelled["message"] == "Termo cancelado"
    released = allocate_inventory_asset(
        asset.id,
        InventoryAllocateRequest(sector_id=sector.id, assigned_user_id=None, movement_date=date(2026, 7, 9)),
        db,
        admin,
    )
    assert released["status"] == "allocated"
    asset.status = "stock"
    asset.assigned_user_id = None
    asset.delivered_at = None
    db.commit()

    term = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="999/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Destino incorreto",
            recipient_user_id=recipient.id,
            recipient_registration="250401573",
            recipient_phone="22-981221739",
            adcetei_signer_name="William Barreto Corrêa",
            adcetei_signer_title="Coordenador Geral de Tecnologia da Informação",
            item_observation="Equipamento locado",
            serial_numbers=["Y5UJHX5YA00227V"],
        ),
        db,
        admin,
    )
    assert term["status"] == "emitted"
    assert term["contract_number"] == "Contrato nº 046/2026 – PMCF / IART"
    assert term["destination_sector_id"] == sector.id
    assert term["destination_unit"] == "Secretaria de Governo e Integridade - ADCETEI"
    db.refresh(recipient)
    assert recipient.registration == "250401573"
    assert recipient.phone == "22-981221739"
    stored_term = db.get(InventoryDeliveryTerm, term["id"])
    assert term_filename(stored_term) == "999-2026 - Termo de Recebimento - Erica Sanches.docx"
    content = render_delivery_term_docx(stored_term)
    with ZipFile(BytesIO(content)) as docx:
        document_xml = docx.read("word/document.xml")
        xml = document_xml.decode("utf-8")
        assert "999/2026" in xml
        assert "Y5UJHX5YA00227V" in xml
        assert "Monitor 24 polegadas" in xml
        assert "Matrícula: 250401573" in xml
        assert "Telefone: 22-981221739" in xml
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        body = ET.fromstring(document_xml).find("w:body", ns)
        children = list(body)
        texts = ["".join(text.text or "" for text in item.findall(".//w:t", ns)).strip() for item in children]
        signature_index = texts.index("________________________________")
        relation_index = texts.index("Relação dos equipamentos recebidos")
        commitment_index = texts.index("Termo de compromisso")
        tables = [(index, item) for index, item in enumerate(children) if item.tag.endswith("tbl")]
        assert len(tables) >= 2
        summary_index, summary_table = tables[0]
        detail_index, detail_table = tables[1]
        assert relation_index < summary_index < commitment_index < detail_index < signature_index
        assert not any(item.findall(".//w:br", ns) for item in children[detail_index + 1:signature_index])
        assert signature_index - detail_index > 2
        detail_rows = detail_table.findall("w:tr", ns)
        detail_cells = detail_rows[1].findall("w:tc", ns)
        assert "".join(text.text or "" for text in detail_cells[-1].findall(".//w:t", ns)).strip() == ""
        for table in [summary_table, detail_table]:
            rows = table.findall("w:tr", ns)
            assert rows[0].find("w:trPr/w:tblHeader", ns) is not None
            assert all(row.find("w:trPr/w:cantSplit", ns) is not None for row in rows)
    expect_conflict(
        lambda: create_delivery_term(
            InventoryDeliveryTermCreate(
                term_number="999/2026",
                contract_id=contract.id,
                issued_at=date(2026, 7, 8),
                recipient_user_id=recipient.id,
                serial_numbers=["ATOMIC-A"],
            ),
            db,
            admin,
        ),
        "Já existe um termo",
    )
    expect_conflict(
        lambda: confirm_delivery_term(term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 7)), db, admin),
        "anterior à data de emissão",
    )
    recipient.department_sector_id = alternate_sector.id
    db.commit()
    expect_conflict(
        lambda: confirm_delivery_term(term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin),
        "lotação do recebedor mudou",
    )
    recipient.department_sector_id = sector.id
    db.commit()
    delivered = confirm_delivery_term(
        term["id"],
        InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)),
        db,
        admin,
    )
    assert delivered["status"] == "delivered"
    db.refresh(asset)
    assert asset.assigned_user_id == recipient.id
    expect_conflict(
        lambda: confirm_delivery_term(term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin),
        "já foi confirmado",
    )
    expect_conflict(
        lambda: confirm_delivery_term(cancellable["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin),
        "cancelado não pode ser confirmado",
    )

    atomic_term = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="200/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            recipient_user_id=recipient.id,
            serial_numbers=["ATOMIC-A", "ATOMIC-B"],
        ),
        db,
        admin,
    )
    atomic_asset_b.status = "maintenance"
    db.commit()
    expect_conflict(
        lambda: confirm_delivery_term(atomic_term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin),
        "não está mais em estoque",
    )
    db.refresh(atomic_asset_a)
    assert atomic_asset_a.status == "stock", "falha no segundo item deve reverter o primeiro"
    atomic_asset_b.status = "stock"
    db.commit()
    confirmed_atomic = confirm_delivery_term(atomic_term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin)
    assert confirmed_atomic["status"] == "delivered"
    db.refresh(atomic_asset_a)
    db.refresh(atomic_asset_b)
    assert atomic_asset_a.status == atomic_asset_b.status == "active"

    empty_recipient.department_sector_id = alternate_sector.id
    db.commit()
    empty_field_term = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="100/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Secretaria de Governo e Integridade - ADCETEI",
            recipient_user_id=empty_recipient.id,
            recipient_registration="",
            recipient_phone="",
            adcetei_signer_name="William Barreto Corrêa",
            adcetei_signer_title="Coordenador Geral de Tecnologia da Informação",
            item_observation="Equipamento locado",
            serial_numbers=["Y5UJHX5YA00228V"],
        ),
        db,
        admin,
    )
    assert empty_field_term["recipient_registration"] == ""
    assert empty_field_term["recipient_phone"] == ""
    db.refresh(empty_recipient)
    assert empty_recipient.registration == ""
    assert empty_recipient.phone == ""
    empty_content = render_delivery_term_docx(db.get(InventoryDeliveryTerm, empty_field_term["id"]))
    with ZipFile(BytesIO(empty_content)) as docx:
        empty_xml = docx.read("word/document.xml").decode("utf-8")
        assert "Matrícula:" in empty_xml
        assert "Telefone:" in empty_xml
        assert "250401573" not in empty_xml
        assert "22-981221739" not in empty_xml
    expect_conflict(
        lambda: confirm_delivery_term(empty_field_term["id"], InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)), db, admin),
        "anterior ao recebimento",
    )
    empty_recipient.department_sector_id = sector.id
    db.commit()
    expect_conflict(lambda: delete_inventory_asset(asset.id, db, admin), "termo de recebimento vinculado")
    expect_conflict(lambda: delete_admin_asset(asset.id, db, admin), "termo de recebimento vinculado")
    expect_conflict(lambda: delete_user(empty_recipient.id, db, admin), "histórico vinculado")
    expect_conflict(lambda: delete_sector(alternate_sector.id, db, admin), "Cadastro possui vínculos")
    assert db.get(Asset, asset.id)
    assert db.get(User, empty_recipient.id)
    assert db.get(InventorySector, alternate_sector.id)
    assert db.scalar(select(InventoryDeliveryTermItem.id).where(InventoryDeliveryTermItem.term_id == empty_field_term["id"]))

print("Termo de recebimento: OK")
PY
