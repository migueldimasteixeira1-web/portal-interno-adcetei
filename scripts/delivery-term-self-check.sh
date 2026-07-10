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
from datetime import date
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from apps.api.app.auth import hash_password
from apps.api.app.database import Base, SessionLocal, engine, ensure_schema_compatibility
from apps.api.app.delivery_terms_docx import render_delivery_term_docx, term_filename
from apps.api.app.models import Asset, InventoryContract, InventoryDeliveryTerm, InventoryEquipmentModel, InventoryEquipmentType, InventoryManufacturer, InventorySector, InventorySupplier, User
from apps.api.app.permissions import ensure_role_configs
from apps.api.app.routers.inventory.terms import cancel_delivery_term, confirm_delivery_term, create_delivery_term, next_term_number, preview_delivery_term
from apps.api.app.schemas import InventoryDeliveryTermCreate, InventoryDeliveryTermDeliver, InventoryDeliveryTermPreview
from apps.api.app.time_utils import utc_now

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

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
        secretariat="Secretaria Adjunta de Ciência e Tecnologia",
        department="SGI",
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
        secretariat="Secretaria Adjunta de Ciência e Tecnologia",
        department="SGI",
        registration="",
        phone="",
    )
    supplier = InventorySupplier(name="Fornecedor", normalized_name="fornecedor")
    equipment_type = InventoryEquipmentType(name="Monitor", normalized_name="monitor")
    manufacturer = InventoryManufacturer(name="Samsung", normalized_name="samsung")
    sector = InventorySector(name="SGI", normalized_name="sgi")
    db.add_all([admin, recipient, empty_recipient, supplier, equipment_type, manufacturer, sector])
    db.flush()
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
    )
    db.add_all([asset, empty_asset])
    db.commit()

    preview = preview_delivery_term(InventoryDeliveryTermPreview(serial_numbers=["Y5UJHX5YA00227V", "Y5UJHX5YA00227V", "NAO-EXISTE"]), db, admin)
    assert preview["valid_count"] == 1
    assert preview["invalid_count"] == 2
    assert "Monitor 24 polegadas" in preview["valid_items"][0]["specification"]

    cancellable = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="001/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Secretaria Adjunta de Ciência e Tecnologia - SGI",
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
    cancelled = cancel_delivery_term(cancellable["id"], db, admin)
    assert cancelled["message"] == "Termo cancelado"

    term = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="999/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Secretaria Adjunta de Ciência e Tecnologia - SGI",
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
    delivered = confirm_delivery_term(
        term["id"],
        InventoryDeliveryTermDeliver(movement_date=date(2026, 7, 9)),
        db,
        admin,
    )
    assert delivered["status"] == "delivered"
    db.refresh(asset)
    assert asset.assigned_user_id == recipient.id

    empty_field_term = create_delivery_term(
        InventoryDeliveryTermCreate(
            term_number="100/2026",
            contract_id=contract.id,
            issued_at=date(2026, 7, 8),
            destination_unit="Secretaria Adjunta de Ciência e Tecnologia - SGI",
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

print("Termo de recebimento: OK")
PY
