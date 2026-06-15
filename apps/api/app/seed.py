from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Asset, ServiceCatalog, Ticket, TicketComment, User
from .time_utils import utc_now


def seed_database(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)):
        return

    users = [
        User(username="admin", full_name="Miguel Dimas", email="admin@cabofrio.rj.gov.br", password_hash=hash_password("admin123"), role="admin", department="Desenvolvimento e Sistemas", source="local"),
        User(username="helpdesk1", full_name="Maiana Ignácio", email="maiana.ignacio@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="helpdesk", department="Central de Atendimento"),
        User(username="helpdesk2", full_name="Herika Raquel", email="herika.raquel@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="helpdesk", department="Central de Atendimento"),
        User(username="helpdesk3", full_name="Paulo Vitor", email="paulo.vitor@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="helpdesk", department="Central de Atendimento"),
        User(username="tecnico", full_name="Lucas Pereira Martins", email="lucas.martins@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="technician", department="Infraestrutura"),
        User(username="servidor", full_name="Kathlelyn Cristina Santos de Abreu", email="kathlelyn.abreu@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="requester", secretariat="Secretaria de Desenvolvimento da Cidade", department="SEGTEA"),
        User(username="marcelo", full_name="Marcelo Godiano dos Santos", email="marcelo.santos@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="requester", secretariat="Secretaria de Administração", department="Recursos Humanos"),
        User(username="thamires", full_name="Thamires de Jesus Gonçalves", email="thamires.goncalves@cabofrio.rj.gov.br", password_hash=hash_password("123456"), role="requester", secretariat="Secretaria de Fazenda", department="Atendimento"),
    ]
    db.add_all(users)
    db.flush()

    assets = [
        Asset(name="ADCETEI-03", asset_type="computer", manufacturer="HP", model="HP 280 BR G5 Small Form Factor", serial_number="BRJ2402M64", patrimony="PC-00368", status="active", location="Sede - CETEI", ip_address="192.168.10.53", operating_system="Microsoft Windows 11 Pro", assigned_user_id=users[1].id, last_seen_at=utc_now() - timedelta(minutes=12)),
        Asset(name="ADSEGTEA004", asset_type="computer", manufacturer="HP", model="EliteDesk 800 G6", serial_number="BRJ2453TZG", patrimony="PC-00189", status="active", location="SEDECON - SEGTEA", ip_address="192.168.22.159", operating_system="Microsoft Windows 11 Pro", assigned_user_id=users[5].id, last_seen_at=utc_now() - timedelta(minutes=21)),
        Asset(name="ADRH-07", asset_type="computer", manufacturer="Dell", model="OptiPlex 7080", serial_number="DL7829A1", patrimony="PC-00204", status="active", location="Administração - RH", ip_address="192.168.14.77", operating_system="Microsoft Windows 10 Pro", assigned_user_id=users[6].id, last_seen_at=utc_now() - timedelta(hours=2)),
        Asset(name="Brother DCP-L2540DW", asset_type="printer", manufacturer="Brother", model="DCP-L2540DW", serial_number="E74472J9N112", patrimony="IMP-00071", status="active", location="SEDECON - SEGTEA", ip_address="192.168.22.18", operating_system="", last_seen_at=utc_now() - timedelta(minutes=35)),
        Asset(name="Monitor 1970W", asset_type="monitor", manufacturer="AOC", model="1970W", serial_number="AOC990177", patrimony="MON-00357", status="active", location="SEDECON - SEGTEA", assigned_user_id=users[5].id),
        Asset(name="SW-CORE-SEDE", asset_type="network", manufacturer="Cisco", model="Catalyst 9300", serial_number="FCW2334L0AA", patrimony="NET-00012", status="active", location="Datacenter - Sede", ip_address="192.168.10.2", last_seen_at=utc_now() - timedelta(minutes=3)),
        Asset(name="NOTEBOOK-TI-05", asset_type="notebook", manufacturer="Lenovo", model="ThinkPad E14", serial_number="PF4M2201", patrimony="NB-00025", status="maintenance", location="Oficina de TI", operating_system="Microsoft Windows 11 Pro"),
        Asset(name="Brother QL-800", asset_type="printer", manufacturer="Brother", model="QL-800", serial_number="QL800-3340", patrimony="IMP-00062", status="stock", location="Estoque TI"),
    ]
    db.add_all(assets)
    db.flush()

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
        Ticket(title="CRIAR/ALTERAR/EXCLUIR CONTA DE E-MAIL", description="Criar conta institucional para nova servidora lotada no setor.", status="waiting_user", priority="medium", urgency="low", impact="low", category="E-mail > Gestão de conta", requester_id=users[7].id, assignee_id=users[2].id, location="Fazenda - Atendimento", created_at=now - timedelta(days=1, hours=3), updated_at=now - timedelta(hours=8), due_at=now + timedelta(hours=12)),
        Ticket(title="COMPUTADOR NÃO LIGA", description="Ao pressionar o botão, o computador não apresenta sinal de energia.", status="in_progress", priority="high", urgency="high", impact="medium", category="Hardware > Computador com problema", requester_id=users[6].id, assignee_id=users[1].id, asset_id=assets[2].id, location="Administração - RH", created_at=now - timedelta(hours=6), updated_at=now - timedelta(minutes=45), due_at=now + timedelta(hours=1)),
        Ticket(title="FALHA NA INTERNET DO SETOR", description="Todas as estações do setor estão sem acesso à internet.", status="assigned", priority="critical", urgency="high", impact="high", category="Rede > Falha na internet", requester_id=users[5].id, assignee_id=users[3].id, asset_id=assets[5].id, location="SEDECON - SEGTEA", created_at=now - timedelta(hours=2), updated_at=now - timedelta(minutes=30), due_at=now + timedelta(minutes=30)),
        Ticket(title="INSTALAÇÃO DO 7-ZIP", description="Solicito instalação do 7-Zip para abertura de arquivos compactados.", status="resolved", priority="low", urgency="low", impact="low", category="Software > Instalação", requester_id=users[5].id, assignee_id=users[2].id, asset_id=assets[1].id, location="SEDECON - SEGTEA", created_at=now - timedelta(days=2), updated_at=now - timedelta(hours=2), due_at=now - timedelta(days=1), closed_at=now - timedelta(hours=2)),
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
