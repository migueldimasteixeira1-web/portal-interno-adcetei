from datetime import datetime, timedelta, timezone
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .inventory_constants import DEFAULT_INVENTORY_SECRETARIAT
from .inventory_service import build_asset_display_name, legacy_asset_status, normalize_catalog_name
from .models import (
    Asset,
    AssetMovement,
    InventoryContract,
    InventoryEquipmentModel,
    InventoryEquipmentType,
    InventoryManufacturer,
    InventorySecretariat,
    InventorySector,
    InventorySupplier,
    ServiceCatalog,
    Ticket,
    TicketComment,
    User,
)
from .time_utils import utc_now


def _dt(year: int, month: int, day: int) -> datetime:
    return datetime(year, month, day, 12, tzinfo=timezone.utc)


def _catalog(model, name: str, **extra):
    return model(name=name, normalized_name=normalize_catalog_name(name), **extra)


def _existing_or_catalog(db: Session, model, name: str, **extra):
    existing = db.scalar(select(model).where(model.normalized_name == normalize_catalog_name(name)))
    return existing or _catalog(model, name, **extra)


def _asset(
    *,
    supplier: InventorySupplier,
    equipment_type: InventoryEquipmentType,
    manufacturer: InventoryManufacturer,
    model: InventoryEquipmentModel,
    sector: InventorySector,
    serial_number: str,
    status: str = "stock",
    assigned_user: User | None = None,
    received_at: datetime | None = None,
    delivered_at: datetime | None = None,
    specifications: str = "",
    notes: str = "",
    retired_at: datetime | None = None,
    retired_by: User | None = None,
    retirement_reason: str = "",
    retirement_justification: str = "",
) -> Asset:
    display_name = build_asset_display_name(equipment_type.name, manufacturer.name, model.name, serial_number)
    return Asset(
        name=display_name[:160],
        asset_type=equipment_type.name[:60],
        manufacturer=manufacturer.name[:100],
        model=model.name[:140],
        serial_number=serial_number,
        specifications=specifications,
        status=legacy_asset_status(status),
        location=sector.name,
        assigned_user_id=assigned_user.id if assigned_user else None,
        supplier_id=supplier.id,
        equipment_type_id=equipment_type.id,
        manufacturer_id=manufacturer.id,
        equipment_model_id=model.id,
        sector_id=sector.id,
        received_at=received_at or _dt(2026, 7, 7),
        delivered_at=delivered_at,
        notes=notes,
        retired_at=retired_at,
        retired_by_user_id=retired_by.id if retired_by else None,
        retirement_reason=retirement_reason,
        retirement_justification=retirement_justification,
        retirement_notes="",
    )


def _movement(db: Session, asset: Asset, actor: User, action: str, movement_at: datetime, notes: str) -> None:
    status = "allocated" if asset.status == "active" else asset.status
    db.add(
        AssetMovement(
            asset_id=asset.id,
            action=action,
            from_sector_id=None,
            to_sector_id=asset.sector_id,
            from_user_id=None,
            to_user_id=asset.assigned_user_id,
            from_status=None,
            to_status=status,
            movement_date=movement_at,
            notes=notes,
            actor_id=actor.id,
        )
    )


def seed_database(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return

    users = [
        User(username="admin", full_name="Miguel Dimas", email="admin@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("admin123"), role="admin", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", source="local", email_verified_at=utc_now()),
        User(username="helpdesk1", full_name="Maiana Ignácio", email="maiana.ignacio@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="technician", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", email_verified_at=utc_now()),
        User(username="helpdesk2", full_name="Herika Raquel", email="herika.raquel@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="technician", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", email_verified_at=utc_now()),
        User(username="helpdesk3", full_name="Paulo Vitor", email="paulo.vitor@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="technician", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", email_verified_at=utc_now()),
        User(username="tecnico", full_name="Lucas Pereira Martins", email="lucas.martins@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="technician", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", email_verified_at=utc_now()),
        User(username="servidor", full_name="Kathlelyn Cristina Santos de Abreu", email="kathlelyn.abreu@sedec.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="user", secretariat="Secretaria de Desenvolvimento da Cidade", department="SEGTEA", registration="250401573", phone="(22) 98122-1739", email_verified_at=utc_now()),
        User(username="marcelo", full_name="Marcelo Godiano dos Santos", email="marcelo.santos@administracao.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="user", secretariat="Secretaria de Administração", department="Recursos Humanos", email_verified_at=utc_now()),
        User(username="thamires", full_name="Thamires de Jesus Gonçalves", email="thamires.goncalves@fazenda.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="user", secretariat="Secretaria de Fazenda", department="Atendimento", email_verified_at=utc_now()),
        User(username="erica.sanches", full_name="Erica Sanches", email="erica.sanches@adppe.cabofrio.rj.gov.br", password_hash=hash_password(secrets.token_urlsafe(32)), role="user", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", active=False, email_verified_at=None),
        User(username="rafael.marques", full_name="Rafael da Silva Marques", email="rafael.marques@segov.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="user", secretariat="Secretaria de Governo", department="SEGOV", registration="SEGOV-001", phone="(22) 99708-4112", email_verified_at=utc_now()),
        User(username="vitor.gomes", full_name="Vitor Gomes Coelho Júnior", email="vitor.gomes@adcetei.cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="user", secretariat=DEFAULT_INVENTORY_SECRETARIAT, department="ADCETEI", registration="SGI-002", email_verified_at=utc_now()),
    ]
    db.add_all(users)
    db.flush()
    user_by_username = {user.username: user for user in users}

    supplier_iart = _catalog(InventorySupplier, "IART")
    db.add(supplier_iart)
    db.flush()
    contracts = [
        _catalog(InventoryContract, "Contrato nº 046/2026 - PMCF / IART", supplier_id=supplier_iart.id),
        _catalog(InventoryContract, "Contrato nº 017/2026 - PMCF / IART", supplier_id=supplier_iart.id),
    ]
    secretariats = [
        _existing_or_catalog(db, InventorySecretariat, DEFAULT_INVENTORY_SECRETARIAT),
        _existing_or_catalog(db, InventorySecretariat, "Secretaria de Fazenda"),
        _existing_or_catalog(db, InventorySecretariat, "Secretaria de Governo"),
        _existing_or_catalog(db, InventorySecretariat, "Secretaria de Administração"),
        _existing_or_catalog(db, InventorySecretariat, "Secretaria de Desenvolvimento da Cidade"),
    ]
    db.add_all(contracts + [item for item in secretariats if item.id is None])
    db.flush()
    secretariat = {item.name: item for item in secretariats}
    default_sector = db.scalar(select(InventorySector).where(InventorySector.normalized_name == normalize_catalog_name("ADCETEI")))
    if default_sector:
        default_sector.secretariat_id = secretariat[DEFAULT_INVENTORY_SECRETARIAT].id
    sectors = [
        default_sector or _catalog(InventorySector, "ADCETEI", secretariat_id=secretariat[DEFAULT_INVENTORY_SECRETARIAT].id),
        _catalog(InventorySector, "FAZENDA", secretariat_id=secretariat["Secretaria de Fazenda"].id),
        _catalog(InventorySector, "Atendimento", secretariat_id=secretariat["Secretaria de Fazenda"].id),
        _catalog(InventorySector, "SEGOV", secretariat_id=secretariat["Secretaria de Governo"].id),
        _catalog(InventorySector, "Recursos Humanos", secretariat_id=secretariat["Secretaria de Administração"].id),
        _catalog(InventorySector, "SEGTEA", secretariat_id=secretariat["Secretaria de Desenvolvimento da Cidade"].id),
    ]
    equipment_types = [
        _catalog(InventoryEquipmentType, "Monitor"),
        _catalog(InventoryEquipmentType, "Computador"),
        _catalog(InventoryEquipmentType, "Notebook"),
        _catalog(InventoryEquipmentType, "Impressora"),
        _catalog(InventoryEquipmentType, "Rede"),
    ]
    manufacturers = [
        _catalog(InventoryManufacturer, "SAMSUNG"),
        _catalog(InventoryManufacturer, "LENOVO"),
        _catalog(InventoryManufacturer, "AOC"),
        _catalog(InventoryManufacturer, "MULTILASER"),
        _catalog(InventoryManufacturer, "ACER"),
        _catalog(InventoryManufacturer, "HP"),
        _catalog(InventoryManufacturer, "Brother"),
        _catalog(InventoryManufacturer, "Cisco"),
    ]
    db.add_all([item for item in sectors if item.id is None] + equipment_types + manufacturers)
    db.flush()
    sector = {item.name: item for item in sectors}
    eq_type = {item.name: item for item in equipment_types}
    maker = {item.name: item for item in manufacturers}
    for seeded_user in users:
        linked_sector = sector.get(seeded_user.department)
        if linked_sector:
            seeded_user.department_sector_id = linked_sector.id
            if linked_sector.secretariat_id:
                seeded_user.secretariat = linked_sector.secretariat.name

    models = [
        _catalog(InventoryEquipmentModel, "S24D400GAL", manufacturer_id=maker["SAMSUNG"].id, equipment_type_id=eq_type["Monitor"].id),
        _catalog(InventoryEquipmentModel, "NEO30S", manufacturer_id=maker["LENOVO"].id, equipment_type_id=eq_type["Computador"].id),
        _catalog(InventoryEquipmentModel, "NEO50S", manufacturer_id=maker["LENOVO"].id, equipment_type_id=eq_type["Computador"].id),
        _catalog(InventoryEquipmentModel, "V15", manufacturer_id=maker["LENOVO"].id, equipment_type_id=eq_type["Notebook"].id),
        _catalog(InventoryEquipmentModel, "22B35HM23", manufacturer_id=maker["AOC"].id, equipment_type_id=eq_type["Monitor"].id),
        _catalog(InventoryEquipmentModel, "UP170", manufacturer_id=maker["MULTILASER"].id, equipment_type_id=eq_type["Computador"].id),
        _catalog(InventoryEquipmentModel, "MK241Y", manufacturer_id=maker["ACER"].id, equipment_type_id=eq_type["Monitor"].id),
        _catalog(InventoryEquipmentModel, "HP 280 BR G5 Small Form Factor", manufacturer_id=maker["HP"].id, equipment_type_id=eq_type["Computador"].id),
        _catalog(InventoryEquipmentModel, "DCP-L2540DW", manufacturer_id=maker["Brother"].id, equipment_type_id=eq_type["Impressora"].id),
        _catalog(InventoryEquipmentModel, "Catalyst 9300", manufacturer_id=maker["Cisco"].id, equipment_type_id=eq_type["Rede"].id),
    ]
    db.add_all(models)
    db.flush()
    model = {item.name: item for item in models}

    stock_note = "Entrada em lote por serie (scan 07/07/2026)."
    assets = [
        _asset(supplier=supplier_iart, equipment_type=eq_type["Computador"], manufacturer=maker["HP"], model=model["HP 280 BR G5 Small Form Factor"], sector=sector["ADCETEI"], serial_number="BRJ2402M64", status="allocated", assigned_user=users[1], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 11), specifications="Desktop HP, Intel Core i5, 8 GB RAM, SSD 256 GB.", notes="Equipamento legado mantido para chamados de exemplo."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Computador"], manufacturer=maker["LENOVO"], model=model["NEO30S"], sector=sector["FAZENDA"], serial_number="BRJ2453TZG", status="allocated", assigned_user=user_by_username["servidor"], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 12), specifications="Desktop Lenovo Neo 30s, Intel Core i5, 8 GB RAM, SSD 256 GB.", notes="Responsável textual original: Kathlelyn Cristina Santos de Abreu."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Computador"], manufacturer=maker["LENOVO"], model=model["NEO50S"], sector=sector["FAZENDA"], serial_number="DL7829A1", status="allocated", assigned_user=user_by_username["marcelo"], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 12), specifications="Desktop Lenovo Neo 50s, Intel Core i5, 16 GB RAM, SSD 512 GB.", notes="Equipamento alocado para teste de movimentação."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Impressora"], manufacturer=maker["Brother"], model=model["DCP-L2540DW"], sector=sector["FAZENDA"], serial_number="E74472J9N112", status="allocated", received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 12), specifications="Impressora multifuncional laser monocromática.", notes="Impressora usada em chamados de instalação."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["AOC"], model=model["22B35HM23"], sector=sector["FAZENDA"], serial_number="AOC990177", status="allocated", assigned_user=user_by_username["servidor"], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 12), specifications="Monitor 21,5 polegadas Full HD.", notes="Monitor legado mantido para chamados de exemplo."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Rede"], manufacturer=maker["Cisco"], model=model["Catalyst 9300"], sector=sector["ADCETEI"], serial_number="FCW2334L0AA", status="allocated", received_at=_dt(2026, 6, 1), delivered_at=_dt(2026, 6, 1), specifications="Switch core 48 portas gerenciável.", notes="Ativo de rede de exemplo."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Notebook"], manufacturer=maker["LENOVO"], model=model["V15"], sector=sector["ADCETEI"], serial_number="PF4M2201", status="maintenance", received_at=_dt(2026, 6, 1), specifications="Notebook Lenovo V15, Intel Core i5, 8 GB RAM, SSD 256 GB.", notes="Notebook em manutenção para testar filtro de situação."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Impressora"], manufacturer=maker["Brother"], model=model["DCP-L2540DW"], sector=sector["ADCETEI"], serial_number="QL800-3340", status="stock", received_at=_dt(2026, 7, 7), specifications="Impressora de etiquetas Brother.", notes="Estoque ADCETEI para teste de alocação."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["ADCETEI"], serial_number="Y5UJHX5YA01307V", received_at=_dt(2026, 7, 7), specifications="Monitor Samsung 24 polegadas Full HD.", notes=stock_note),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["ADCETEI"], serial_number="Y5UJHX5L300471", received_at=_dt(2026, 7, 7), specifications="Monitor Samsung 24 polegadas Full HD.", notes=stock_note),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["ADCETEI"], serial_number="Y5UJHX5L300474", received_at=_dt(2026, 7, 7), specifications="Monitor Samsung 24 polegadas Full HD.", notes=stock_note),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Computador"], manufacturer=maker["LENOVO"], model=model["NEO50S"], sector=sector["ADCETEI"], serial_number="PE0DJANZ", received_at=_dt(2026, 6, 1), specifications="Desktop Lenovo Neo 50s, Intel Core i5, 16 GB RAM, SSD 512 GB.", notes="Origem importacao: EXPORTAÇÃO SERVIDOR.xlsx / Planilha1 / linha 82"),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Computador"], manufacturer=maker["LENOVO"], model=model["NEO30S"], sector=sector["ADCETEI"], serial_number="PE0FQG1X", received_at=_dt(2026, 6, 1), specifications="Desktop Lenovo Neo 30s, Intel Core i5, 8 GB RAM, SSD 256 GB.", notes="Origem importacao: EXPORTAÇÃO SERVIDOR.xlsx / Planilha1 / linha 81"),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["ADCETEI"], serial_number="Y5UJHX5L300447", status="allocated", assigned_user=user_by_username["vitor.gomes"], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 11), specifications="Monitor Samsung 24 polegadas Full HD.", notes="Responsavel textual original: Vitor Gomes Coelho Júnior"),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["SEGOV"], serial_number="Y5UJHX5YA01455L", status="allocated", assigned_user=user_by_username["rafael.marques"], received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 12), specifications="Monitor Samsung 24 polegadas Full HD.", notes="Responsavel textual original: Rafael da Silva Marques"),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["SAMSUNG"], model=model["S24D400GAL"], sector=sector["ADCETEI"], serial_number="Y5UJHX5YA00640Y", status="stock", received_at=_dt(2026, 6, 10), delivered_at=_dt(2026, 6, 10), specifications="Monitor Samsung 24 polegadas Full HD.", notes="Item devolvido ao estoque para testar termo de equipamento usado."),
        _asset(supplier=supplier_iart, equipment_type=eq_type["Monitor"], manufacturer=maker["ACER"], model=model["MK241Y"], sector=sector["ADCETEI"], serial_number="MMV9SAA002544007E29501", status="retired", received_at=_dt(2026, 6, 1), retired_at=_dt(2026, 8, 6), retired_by=user_by_username["admin"], retirement_reason="SUBSTITUICAO", retirement_justification="Substituicao por monitor Samsung conforme controle IART.", specifications="Monitor Acer 23,8 polegadas.", notes="Responsavel textual original: DEVOLUÇÃO"),
    ]
    db.add_all(assets)
    db.flush()

    for asset in assets:
        action = "retired" if asset.status == "retired" else "created"
        movement_at = asset.retired_at or asset.delivered_at or asset.received_at or utc_now()
        _movement(db, asset, user_by_username["admin"], action, movement_at, asset.notes or "Carga inicial de demonstração.")

    services = [
        ServiceCatalog(name="Instalar impressora", category="Hardware", description="Instalação, configuração ou compartilhamento de impressora.", icon="Print", color="#2563eb", form_schema={"fields": ["local", "computer", "printer_model", "printer_ip"]}),
        ServiceCatalog(name="Falha no acesso ao e-mail", category="E-mail", description="Problemas para entrar, enviar ou receber mensagens.", icon="Email", color="#7c3aed", form_schema={"fields": ["email_account", "error_message"]}),
        ServiceCatalog(name="Criar, alterar ou excluir conta", category="Acesso", description="Solicitação relacionada a contas institucionais.", icon="ManageAccounts", color="#0891b2", form_schema={"fields": ["person_name", "cpf", "requested_action", "authorization"]}),
        ServiceCatalog(name="Ativar usuário", category="Acesso", description="Ativação ou desbloqueio de usuário de domínio.", icon="PersonAdd", color="#0f766e", form_schema={"fields": ["username", "department"]}),
        ServiceCatalog(name="Computador com problema", category="Hardware", description="Computador não liga, está lento ou apresenta falhas.", icon="Computer", color="#dc2626", form_schema={"fields": ["computer", "symptoms", "started_at"]}),
        ServiceCatalog(name="Falha na internet", category="Rede", description="Sem acesso à internet ou à rede interna.", icon="WifiOff", color="#ea580c", form_schema={"fields": ["location", "computer", "scope"]}),
        ServiceCatalog(name="Instalar computador", category="Hardware", description="Preparação e instalação de novo computador.", icon="DesktopWindows", color="#4f46e5", form_schema={"fields": ["location", "responsible_user", "network_point"]}),
        ServiceCatalog(name="Instalar sistema", category="Software", description="Instalação ou atualização de aplicativo autorizado.", icon="Apps", color="#059669", form_schema={"fields": ["software_name", "computer", "license"]}),
        ServiceCatalog(name="Solicitação geral", category="Outros", description="Use quando nenhuma opção representar sua necessidade.", icon="SupportAgent", color="#64748b", form_schema={"fields": ["details"]}),
    ]
    db.add_all(services)
    db.flush()

    now = utc_now()
    tickets = [
        Ticket(title="INSTALAR IMPRESSORA", description="Solicito a instalação da impressora Brother na estação ADSEGTEA004. IP da impressora: 192.168.22.18.", status="new", priority="medium", urgency="medium", impact="medium", category="Hardware > Instalar impressora", requester_id=users[5].id, asset_id=assets[1].id, location="SEDECON - SEGTEA", created_at=now - timedelta(minutes=24), updated_at=now - timedelta(minutes=24), due_at=now + timedelta(days=2)),
        Ticket(title="FALHA NO ACESSO AO E-MAIL", description="A conta institucional informa senha incorreta mesmo após a redefinição.", status="new", priority="medium", urgency="medium", impact="low", category="E-mail > Falha no acesso", requester_id=users[6].id, location="Administração - RH", created_at=now - timedelta(hours=4), updated_at=now - timedelta(hours=4), due_at=now - timedelta(hours=1)),
        Ticket(title="INSTALAR IMPRESSORA", description="Necessário instalar a impressora do atendimento no computador do setor.", status="assigned", priority="medium", urgency="medium", impact="medium", category="Hardware > Instalar impressora", requester_id=users[7].id, assignee_id=users[4].id, asset_id=assets[2].id, location="Fazenda - Atendimento", created_at=now - timedelta(days=1), updated_at=now - timedelta(hours=5), due_at=now - timedelta(hours=2)),
        Ticket(title="CRIAR/ALTERAR/EXCLUIR CONTA DE E-MAIL", description="Criar conta institucional para nova servidora lotada no setor.", status="assigned", priority="medium", urgency="low", impact="low", category="E-mail > Gestão de conta", requester_id=users[7].id, assignee_id=users[2].id, location="Fazenda - Atendimento", created_at=now - timedelta(days=1, hours=3), updated_at=now - timedelta(hours=8), due_at=now + timedelta(hours=12)),
        Ticket(title="COMPUTADOR NÃO LIGA", description="Ao pressionar o botão, o computador não apresenta sinal de energia.", status="assigned", priority="high", urgency="high", impact="medium", category="Hardware > Computador com problema", requester_id=users[6].id, assignee_id=users[1].id, asset_id=assets[2].id, location="Administração - RH", created_at=now - timedelta(hours=6), updated_at=now - timedelta(minutes=45), due_at=now + timedelta(hours=1)),
        Ticket(title="FALHA NA INTERNET DO SETOR", description="Todas as estações do setor estão sem acesso à internet.", status="assigned", priority="critical", urgency="high", impact="high", category="Rede > Falha na internet", requester_id=users[5].id, assignee_id=users[3].id, asset_id=assets[5].id, location="SEDECON - SEGTEA", created_at=now - timedelta(hours=2), updated_at=now - timedelta(minutes=30), due_at=now + timedelta(minutes=30)),
        Ticket(title="INSTALAÇÃO DO 7-ZIP", description="Solicito instalação do 7-Zip para abertura de arquivos compactados.", status="closed", priority="low", urgency="low", impact="low", category="Software > Instalação", requester_id=users[5].id, assignee_id=users[2].id, asset_id=assets[1].id, location="SEDECON - SEGTEA", created_at=now - timedelta(days=2), updated_at=now - timedelta(hours=2), due_at=now - timedelta(days=1), closed_at=now - timedelta(hours=2)),
        Ticket(title="ATUALIZAÇÃO DO WINDOWS", description="A estação solicita atualização e reinicia durante o expediente.", status="closed", priority="medium", urgency="low", impact="low", category="Software > Sistema operacional", requester_id=users[6].id, assignee_id=users[4].id, asset_id=assets[2].id, location="Administração - RH", created_at=now - timedelta(days=5), updated_at=now - timedelta(days=1), due_at=now - timedelta(days=3), closed_at=now - timedelta(days=1)),
    ]
    db.add_all(tickets)
    db.flush()

    comments = [
        TicketComment(ticket_id=tickets[0].id, author_id=users[5].id, body="Chamado aberto pelo Portal do Servidor.", event_type="event"),
        TicketComment(ticket_id=tickets[2].id, author_id=users[4].id, body="Chamado recebido. Vou verificar o computador e a conectividade com a impressora.", internal=False),
        TicketComment(ticket_id=tickets[2].id, author_id=users[1].id, body="Triagem concluída e encaminhada para Infraestrutura.", internal=True, event_type="assignment"),
        TicketComment(ticket_id=tickets[4].id, author_id=users[1].id, body="Atendimento iniciado. Solicitado teste em outra tomada antes do deslocamento.", internal=False),
        TicketComment(ticket_id=tickets[6].id, author_id=users[2].id, body="Software instalado e testado com sucesso.", internal=False),
    ]
    db.add_all(comments)
    db.commit()
