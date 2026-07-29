#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT_DIR/apps/api"
API_PYTHON="$ROOT_DIR/apps/api/.venv/bin/python"
TEST_DB="$(mktemp /tmp/portal-return-term-XXXX.db)"

cleanup() {
  rm -f "$TEST_DB"
}
trap cleanup EXIT

if [[ ! -x "$API_PYTHON" ]]; then
  echo "Ambiente Python não encontrado. Execute ./iniciar-local.sh uma vez."
  exit 1
fi

cd "$ROOT_DIR"
(cd "$API_DIR" && DATABASE_URL="sqlite:///$TEST_DB" ENVIRONMENT=test SEED_DEMO_DATA=false "$API_PYTHON" -m alembic upgrade head)
DATABASE_URL="sqlite:///$TEST_DB" ENVIRONMENT=test SECRET_KEY="chave-local-para-termos" "$API_PYTHON" - <<'PY'
from datetime import date, datetime, timezone
from io import BytesIO
from zipfile import ZipFile
from xml.etree import ElementTree as ET

from fastapi import HTTPException
from sqlalchemy import select

from apps.api.app.auth import hash_password
from apps.api.app.database import SessionLocal
from apps.api.app.return_terms_docx import render_return_term_docx, term_filename
from apps.api.app.models import (
    Asset,
    InventoryContract,
    InventoryDeliveryTerm,
    InventoryEquipmentModel,
    InventoryEquipmentType,
    InventoryManufacturer,
    InventoryReturnTerm,
    InventoryReturnTermItem,
    InventorySecretariat,
    InventorySector,
    InventorySupplier,
    User,
)
from apps.api.app.permissions import ensure_role_configs
from apps.api.app.routers.admin.assets import delete_asset as delete_admin_asset
from apps.api.app.routers.admin.users import delete_user
from apps.api.app.routers.inventory.assets import delete_inventory_asset
from apps.api.app.routers.inventory.catalogs import delete_contract, delete_sector
from apps.api.app.routers.inventory.terms import (
    cancel_return_term,
    confirm_return_term,
    create_return_term,
    next_return_term_number,
    preview_return_term,
)
from apps.api.app.schemas import InventoryReturnTermConfirm, InventoryReturnTermCreate, InventoryReturnTermPreview
from apps.api.app.time_utils import utc_now


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
    returner = User(
        username="kaline",
        full_name="Kaline Caldeira",
        email="kaline.almeida@secciv.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="user",
        active=False,
        secretariat="Prefeitura de Cabo Frio",
        department="Casa Civil",
        registration="",
        phone="",
    )
    other_returner = User(
        username="leandro",
        full_name="Leandro de Macedo Trindade",
        email="ti@fazenda.cabofrio.rj.gov.br",
        password_hash=hash_password("senha-temporaria"),
        role="user",
        active=False,
        secretariat="Prefeitura de Cabo Frio",
        department="Fazenda",
        registration="",
        phone="",
    )
    supplier = InventorySupplier(name="Simpress", normalized_name="simpress")
    equipment_type = InventoryEquipmentType(name="Desktop", normalized_name="desktop")
    manufacturer = InventoryManufacturer(name="HP", normalized_name="hp")
    secretariat = InventorySecretariat(
        name="Secretaria de Gestão e Inovação",
        normalized_name="secretaria de gestão e inovação",
    )
    db.add_all([admin, returner, other_returner, supplier, equipment_type, manufacturer, secretariat])
    db.flush()
    sector = InventorySector(name="ADCETEI", normalized_name="adcetei", secretariat_id=secretariat.id)
    origin_sector = InventorySector(name="SECCIV", normalized_name="secciv", secretariat_id=secretariat.id)
    alternate_sector = InventorySector(name="Outro Setor", normalized_name="outro setor", secretariat_id=secretariat.id)
    db.add_all([sector, origin_sector, alternate_sector])
    db.flush()
    returner.department_sector_id = origin_sector.id
    other_returner.department_sector_id = origin_sector.id
    contract = InventoryContract(
        name="Contrato nº 104/2022 – PMCF / SIMPRESS",
        normalized_name="contrato-104-2022-pmcf-simpress",
        supplier_id=supplier.id,
    )
    model = InventoryEquipmentModel(
        name="280 G5 SFF",
        normalized_name="280 g5 sff",
        manufacturer_id=manufacturer.id,
        equipment_type_id=equipment_type.id,
    )
    db.add_all([contract, model])
    db.flush()
    related_term = InventoryDeliveryTerm(
        term_number="101/2026",
        contract_id=contract.id,
        contract_number=contract.name,
        issued_at=datetime(2026, 5, 20, 12, tzinfo=timezone.utc),
        destination_sector_id=origin_sector.id,
        destination_unit="Secretaria de Gestão e Inovação - SECCIV",
        recipient_user_id=returner.id,
        recipient_name=returner.full_name,
        recipient_email=returner.email,
        status="delivered",
    )
    db.add(related_term)
    db.flush()

    allocated_asset = Asset(
        name="Desktop HP 280 G5 SFF",
        asset_type="Desktop",
        manufacturer="HP",
        model="280 G5 SFF",
        serial_number="BRJ2402M85",
        specifications="HP 280 G5 SFF I5 10400 8GB RAM 256 GB SSD",
        status="active",
        location="SECCIV",
        supplier_id=supplier.id,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=model.id,
        sector_id=origin_sector.id,
        assigned_user_id=returner.id,
        delivered_at=datetime(2026, 5, 22, 12, tzinfo=timezone.utc),
    )
    second_allocated_asset = Asset(
        name="Monitor HP P22A G4", asset_type="Monitor", serial_number="BRC22705R0",
        status="active", sector_id=origin_sector.id, assigned_user_id=returner.id,
        delivered_at=datetime(2026, 5, 22, 12, tzinfo=timezone.utc),
    )
    stock_asset = Asset(name="Em estoque", asset_type="Desktop", serial_number="STATUS-STOCK", status="stock", sector_id=sector.id)
    maintenance_asset = Asset(name="Manutenção", asset_type="Desktop", serial_number="STATUS-MAINTENANCE", status="maintenance", sector_id=sector.id)
    retired_asset = Asset(name="Baixado", asset_type="Desktop", serial_number="STATUS-RETIRED", status="retired", sector_id=sector.id)
    atomic_asset_a = Asset(
        name="Atômico A", asset_type="Desktop", serial_number="ATOMIC-A", status="active",
        sector_id=origin_sector.id, assigned_user_id=other_returner.id, delivered_at=datetime(2026, 6, 1, 12, tzinfo=timezone.utc),
    )
    atomic_asset_b = Asset(
        name="Atômico B", asset_type="Desktop", serial_number="ATOMIC-B", status="active",
        sector_id=origin_sector.id, assigned_user_id=other_returner.id, delivered_at=datetime(2026, 6, 1, 12, tzinfo=timezone.utc),
    )
    db.add_all([allocated_asset, second_allocated_asset, stock_asset, maintenance_asset, retired_asset, atomic_asset_a, atomic_asset_b])
    db.commit()

    preview = preview_return_term(
        InventoryReturnTermPreview(returner_user_id=returner.id, serial_numbers=["BRJ2402M85", "BRJ2402M85", "NAO-EXISTE"]),
        db,
        admin,
    )
    assert preview["valid_count"] == 1
    assert preview["invalid_count"] == 2

    for serial, expected in (
        ("STATUS-STOCK", "alocado"),
        ("STATUS-MAINTENANCE", "alocado"),
        ("STATUS-RETIRED", "baixado"),
    ):
        rejected = preview_return_term(InventoryReturnTermPreview(returner_user_id=returner.id, serial_numbers=[serial]), db, admin)
        assert rejected["valid_count"] == 0, serial
        assert expected in rejected["errors"][0]["message"].lower(), serial

    wrong_owner = preview_return_term(
        InventoryReturnTermPreview(returner_user_id=other_returner.id, serial_numbers=["BRJ2402M85"]), db, admin
    )
    assert wrong_owner["invalid_count"] == 1
    assert "não está vinculado a este devolvedor" in wrong_owner["errors"][0]["message"].lower()

    assert next_return_term_number(db) == "001/2026"

    cancellable = create_return_term(
        InventoryReturnTermCreate(
            term_number="001/2026",
            contract_id=contract.id,
            related_delivery_term_id=related_term.id,
            issued_at=date(2026, 7, 20),
            returner_user_id=returner.id,
            returner_registration="",
            returner_phone="",
            adcetei_signer_name="William Barreto Corrêa",
            adcetei_signer_title="Coordenador Geral de Tecnologia da Informação",
            item_observation="Equipamento devolvido",
            serial_numbers=["BRJ2402M85"],
        ),
        db,
        admin,
    )
    assert next_return_term_number(db) == "002/2026"
    expect_conflict(
        lambda: create_return_term(
            InventoryReturnTermCreate(
                term_number="900/2026", issued_at=date(2026, 7, 20),
                returner_user_id=returner.id, serial_numbers=["BRJ2402M85"],
            ),
            db, admin,
        ),
        "termo de devolução aberto 001/2026",
    )
    cancelled = cancel_return_term(cancellable["id"], db, admin)
    assert cancelled["message"] == "Termo cancelado"

    term = create_return_term(
        InventoryReturnTermCreate(
            term_number="099/2026",
            contract_id=contract.id,
            related_delivery_term_id=related_term.id,
            issued_at=date(2026, 7, 20),
            returner_user_id=returner.id,
            returner_registration="",
            returner_phone="",
            adcetei_signer_name="William Barreto Corrêa",
            adcetei_signer_title="Coordenador Geral de Tecnologia da Informação",
            item_observation="Equipamento devolvido",
            serial_numbers=["BRJ2402M85"],
        ),
        db,
        admin,
    )
    assert term["status"] == "emitted"
    assert term["contract_number"] == "Contrato nº 104/2022 – PMCF / SIMPRESS"
    assert term["origin_sector_id"] == origin_sector.id
    assert term["origin_unit"] == "Secretaria de Gestão e Inovação - SECCIV"
    assert term["related_delivery_term_id"] == related_term.id

    stored_term = db.get(InventoryReturnTerm, term["id"])
    assert term_filename(stored_term) == "099-2026 - Termo de Devolução - Kaline Caldeira.docx"
    content = render_return_term_docx(stored_term)
    with ZipFile(BytesIO(content)) as docx:
        document_xml = docx.read("word/document.xml")
        xml = document_xml.decode("utf-8")
        assert "099/2026" in xml
        assert "BRJ2402M85" in xml
        assert "referente ao Termo de Recebimento e Responsabilidade nº 101/2026" in xml
        assert "vinculado(s) ao Contrato nº 104/2022 – PMCF / SIMPRESS" in xml
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        body = ET.fromstring(document_xml).find("w:body", ns)
        children = list(body)
        texts = ["".join(text.text or "" for text in item.findall(".//w:t", ns)).strip() for item in children]
        signature_index = texts.index("________________________________")
        relation_index = texts.index("Relação dos equipamentos devolvidos")
        tables = [(index, item) for index, item in enumerate(children) if item.tag.endswith("tbl")]
        assert len(tables) >= 2
        summary_index, summary_table = tables[0]
        detail_index, detail_table = tables[1]
        assert relation_index < summary_index < detail_index < signature_index
        # Devolvedor assina primeiro, ADCETEI em segundo (ordem invertida em relação ao termo de recebimento).
        assert texts[signature_index + 1] == "Kaline Caldeira"
        second_signature_index = texts.index("________________________________", signature_index + 1)
        assert texts[second_signature_index + 1] == "William Barreto Corrêa"
        for table in [summary_table, detail_table]:
            rows = table.findall("w:tr", ns)
            assert rows[0].find("w:trPr/w:tblHeader", ns) is not None
            assert all(row.find("w:trPr/w:cantSplit", ns) is not None for row in rows)

    expect_conflict(
        lambda: create_return_term(
            InventoryReturnTermCreate(
                term_number="099/2026", issued_at=date(2026, 7, 20),
                returner_user_id=other_returner.id, serial_numbers=["ATOMIC-A"],
            ),
            db, admin,
        ),
        "Já existe um termo",
    )
    expect_conflict(
        lambda: confirm_return_term(term["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 1)), db, admin),
        "anterior à data de emissão",
    )
    confirmed = confirm_return_term(term["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 21)), db, admin)
    assert confirmed["status"] == "confirmed"
    db.refresh(allocated_asset)
    assert allocated_asset.status == "stock"
    assert allocated_asset.assigned_user_id is None
    assert allocated_asset.sector_id == sector.id
    expect_conflict(
        lambda: confirm_return_term(term["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 21)), db, admin),
        "já foi confirmado",
    )
    expect_conflict(
        lambda: confirm_return_term(cancellable["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 21)), db, admin),
        "cancelado não pode ser confirmado",
    )

    atomic_term = create_return_term(
        InventoryReturnTermCreate(
            term_number="200/2026", issued_at=date(2026, 7, 20),
            returner_user_id=other_returner.id, serial_numbers=["ATOMIC-A", "ATOMIC-B"],
        ),
        db,
        admin,
    )
    atomic_asset_b.status = "maintenance"
    db.commit()
    expect_conflict(
        lambda: confirm_return_term(atomic_term["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 21)), db, admin),
        "não está mais alocado",
    )
    db.refresh(atomic_asset_a)
    assert atomic_asset_a.status == "active", "falha no segundo item deve reverter o primeiro"
    atomic_asset_b.status = "active"
    db.commit()
    confirmed_atomic = confirm_return_term(atomic_term["id"], InventoryReturnTermConfirm(movement_date=date(2026, 7, 21)), db, admin)
    assert confirmed_atomic["status"] == "confirmed"
    db.refresh(atomic_asset_a)
    db.refresh(atomic_asset_b)
    assert atomic_asset_a.status == atomic_asset_b.status == "stock"

    empty_field_term = create_return_term(
        InventoryReturnTermCreate(
            term_number="300/2026", issued_at=date(2026, 7, 20),
            returner_user_id=returner.id, returner_registration="", returner_phone="",
            serial_numbers=["BRC22705R0"],
        ),
        db,
        admin,
    )
    assert empty_field_term["returner_registration"] == ""
    assert empty_field_term["returner_phone"] == ""
    empty_content = render_return_term_docx(db.get(InventoryReturnTerm, empty_field_term["id"]))
    with ZipFile(BytesIO(empty_content)) as docx:
        empty_xml = docx.read("word/document.xml").decode("utf-8")
        assert "Matrícula:" in empty_xml
        assert "Telefone:" in empty_xml

    expect_conflict(lambda: delete_inventory_asset(allocated_asset.id, db, admin), "termo de devolução vinculado")
    expect_conflict(lambda: delete_admin_asset(allocated_asset.id, db, admin), "termo de devolução vinculado")
    expect_conflict(lambda: delete_user(returner.id, db, admin), "histórico vinculado")
    expect_conflict(lambda: delete_sector(origin_sector.id, db, admin), "Cadastro possui vínculos")
    expect_conflict(lambda: delete_contract(contract.id, db, admin), "Cadastro possui vínculos")
    assert db.get(Asset, allocated_asset.id)
    assert db.get(User, returner.id)
    assert db.get(InventorySector, origin_sector.id)
    assert db.get(InventoryContract, contract.id)
    assert db.scalar(select(InventoryReturnTermItem.id).where(InventoryReturnTermItem.term_id == term["id"]))

print("Termo de devolução: OK")
PY
