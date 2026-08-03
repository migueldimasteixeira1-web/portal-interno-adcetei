# Arquitetura do Portal Interno ADCETEI

## Visão geral

O sistema é um **hub operacional modular** da ADCETEI — monólito em execução, separado por domínio no código. Chamados, inventário e mensagens são módulos maduros; impressoras, memorandos e catálogo de VMs permanecem planejados.

```text
Portal Interno ADCETEI
├── Núcleo
│   ├── autenticação (e-mail institucional + JWT)
│   ├── usuários e perfis
│   ├── sessão
│   └── auditoria
├── Chamados
│   ├── catálogo de serviços
│   ├── abertura com campos dinâmicos
│   ├── triagem e histórico
│   └── notas internas
├── Mensagens
│   ├── conversas diretas entre servidores (1:1)
│   ├── diretório de contatos (qualquer usuário ativo)
│   └── contagem de não lidas
├── Inventário
│   ├── cadastros base (fornecedor, tipo, fabricante, modelo, setor)
│   ├── equipamentos e movimentações
│   ├── entrada em lote por série
│   ├── termos de recebimento e devolução, com confirmação antes de movimentar
│   └── opções resumidas para chamados
├── Acesso Remoto
│   ├── listagem de computadores MeshCentral
│   ├── sessões com motivo e auditoria
│   └── visualizador em nova aba (login token)
└── Administração
    ├── usuários
    ├── catálogo de serviços
    ├── equipamentos legados
    ├── perfis e permissões
    └── auditoria
```

## Organização do código

### Backend (`apps/api/app/`)

| Caminho | Papel |
|---------|--------|
| `main.py` | Factory FastAPI, CORS, `include_router` e startup dos dados iniciais |
| `routers/auth.py` | Login, cadastro, verificação de e-mail |
| `routers/tickets.py` | Chamados e dashboard |
| `routers/chat.py` | Conversas diretas, contatos e contagem de não lidas |
| `routers/users_assets.py` | Usuários, assets legados, opções para chamados |
| `routers/admin/` | Usuários admin, assets, catálogo, perfis, auditoria |
| `routers/inventory/` | Meta, equipamentos modulares, cadastros base |
| `routers/remote_access.py` | Dispositivos remotos, sessões e auditoria |
| `integrations/meshcentral_client.py` | Cliente HTTP do mesh-bridge |
| `serializers/` | Serialização de users, assets e tickets |
| `services/tickets_service.py` | Regras de negócio de chamados |
| `services/chat_service.py` | Conversas, mensagens, leitura e busca de contatos |
| `admin_api.py` | Reexport: `from .routers.admin import router` |
| `inventory_api.py` | Reexport: `from .routers.inventory import router` |
| `inventory_service.py` | Regras de inventário e movimentações |
| `inventory_helpers.py`, `admin_helpers.py` | Helpers compartilhados dos routers |
| `schemas.py` | Schemas Pydantic (monolítico de propósito — evita imports circulares) |
| `models.py`, `database.py`, `permissions.py` | Persistência e RBAC |
| `alembic/` | Baseline e migrations — única autoridade do schema |

Rotas públicas principais:

- `/api/auth/*`, `/api/tickets/*`, `/api/users`, `/api/assets/*`
- `/api/chat/*`
- `/api/admin/*`
- `/api/inventory/*`

### Frontend (`apps/web/`)

| Caminho | Papel |
|---------|--------|
| `app/` | Rotas Next.js — páginas **orquestradoras** (estado, fetch, permissões) |
| `features/<domínio>/` | Composição de UI por módulo (`admin`, `chat`, `dashboard`, `inventory`, `remote-access`, `tickets`) |
| `components/` | UI compartilhada (`ui.tsx`, layout, chips, paginação, etc.) |
| `lib/api/` | Cliente HTTP por domínio; `lib/api.ts` reexporta objeto `api` unificado |
| `lib/types/` | Tipos TypeScript por domínio; `lib/types.ts` reexporta tudo |
| `lib/format.ts`, `lib/modules.ts`, `lib/permissions.ts` | Formatação, navegação modular e checagem de perfil no cliente |

Imports existentes `@/lib/api` e `@/lib/types` continuam válidos após a modularização.

### Páginas e features

| Rota | Feature principal |
|------|-------------------|
| `/dashboard` | `features/dashboard/DashboardSections` |
| `/chamados`, `/chamados/novo`, `/chamados/[id]` | `features/tickets/*` |
| `/mensagens` | `features/chat/*` |
| `/inventario`, `/inventario/[id]`, `/inventario/lote`, `/inventario/novo` | `features/inventory/*` |
| `/inventario/termos` | Termos de recebimento e devolução (`features/inventory/DeliveryTermsPanel`, `ReturnTermsPanel`) |
| `/administracao/base-cadastros`, `/administracao/catalogo`, `/administracao/usuarios` | `features/admin/*` |
| `/administracao/perfis`, `/administracao/auditoria` | Inline (telas menores) |
| `/acesso-remoto`, `/acesso-remoto/sessoes/[id]` | `features/remote-access/*` |

## Frontend — detalhes

- Next.js App Router, React, TypeScript, Tailwind CSS, Radix Dialog;
- tokens visuais em `app/globals.css`;
- estado de autenticação em `components/AuthProvider.tsx`.

### Sessão

O cliente HTTP detecta `401` apenas em requisições que possuíam token. Ele limpa o armazenamento e emite um evento global. O `AuthProvider` recebe esse evento, remove o usuário do estado e redireciona para o login.

Um bloqueio impede múltiplos redirecionamentos simultâneos quando várias chamadas retornam `401`.

## Backend — detalhes

- FastAPI, SQLAlchemy, Pydantic, JWT;
- SQLite no ambiente local; PostgreSQL no Docker;
- SMTP para verificação de e-mail institucional.

## Autorização

Ações protegidas por permissões em `role_configs`, não só pelo nome do perfil. Dependências automáticas:

- triagem inclui visão de chamados, usuários e inventário;
- gestão de usuários inclui consulta de usuários;
- gestão de equipamentos inclui consulta do inventário.

Mudanças em usuários, equipamentos, catálogo e perfis geram `audit_logs`. Exclusões destrutivas são limitadas: contas bloqueadas, serviços arquivados, equipamentos com histórico preservado.

## Autenticação

Fluxo `AUTH_MODE=email`:

```text
cadastro público -> e-mail institucional -> token de verificação -> senha local -> JWT
```

Padrão aceito: `usuario@secretaria.cabofrio.rj.gov.br`. Contas públicas nascem como solicitante, sem e-mail verificado. Técnico e Administrador são atribuídos manualmente.

## Inventário

A tabela `assets` permanece como base dos equipamentos (`asset_id` em chamados). Rotas legadas de `/api/assets` coexistem com o contrato modular em `/api/inventory/assets`.

- Cadastros base: `/api/inventory/catalogs` — secretarias, setores vinculados a secretaria, fornecedores, contratos vinculados a fornecedor, tipos, fabricantes e modelos (`inventory.view` / `inventory.manage_catalogs`)
- Hierarquia conhecida: `Secretaria de Gestão e Inovação (SGI) → ADCETEI`; outros setores dependem de classificação administrativa
- Equipamentos: número de série como ID principal, especificações e vínculos opcionais aos cadastros
- Movimentações em `asset_movements`: alocação, responsável, estoque, manutenção
- Lote: `/api/inventory/assets/bulk-scan` — pré-validação e criação em estoque ADCETEI
- Termos: `/api/inventory/delivery-terms` — número sugerido, contrato cadastrado, prévia por número de série, emissão/cancelamento do DOCX oficial a partir do template e confirmação de entrega sem alterar o inventário antes da assinatura
- Reserva de termos derivada de itens em termos `draft`/`emitted`; criação e confirmação revalidam o estoque em transação, com bloqueio de linha no PostgreSQL
- Usuários, setores e equipamentos citados por qualquer termo não podem ser excluídos; o snapshot e as chaves estrangeiras preservam o documento oficial
- Exportação: `GET /api/inventory/assets/export` — planilha `.xlsx` com os mesmos filtros da listagem (`inventory.view`), incluindo secretaria e setor; inclui `Secretaria` antes de `Setor`; coluna “Última movimentação” usa a entrada mais recente por `movement_date` (desempate por `id`)
- Baixa: `POST /api/inventory/assets/{id}/retire` — status `retired` com motivo, justificativa, movimentação `retired` e auditoria `inventory_asset_retired` (`inventory.move`; correção administrativa só admin)
- Tela `/administracao/base-cadastros` para CRUD dos cadastros base; `/inventario/cadastros` redireciona para ela
- Setor `ADCETEI` protegido contra renomeação/desativação via API
- Ação única de movimentação direta define setor e, opcionalmente, responsável; a API valida que o responsável pertence ao setor de destino

Termos de recebimento usam o cadastro existente de `users` como cadastro único de pessoas. Uma conta pode ficar bloqueada para login (`active=false`) e ainda ser usada como responsável recebedor do termo. A confirmação de entrega aplica a alocação em lote nos ativos e registra uma movimentação individual para cada equipamento.

### Termos de devolução

Simétrico ao termo de recebimento — mesma engrenagem (modelo, numeração sequencial, template DOCX, fluxo emitido → confirmado/cancelado), adaptada para o sentido inverso (equipamento → estoque):

- `InventoryReturnTerm`/`InventoryReturnTermItem` (`/api/inventory/return-terms`) são tabelas próprias, não um reaproveitamento direto de `InventoryDeliveryTerm` — os campos (`returner_*`, `origin_sector_id`) e o status final (`confirmed`, não `delivered`) são de fato diferentes. A generalização num modelo "Documento" polimórfico único fica para uma etapa futura (ver auditoria de arquitetura, item de Documento generalizado), depois que os dois fluxos tiverem rodado em produção
- `contract_id`/`contract_number` e `related_delivery_term_id` são opcionais: cobre tanto equipamento locado (com contrato e, opcionalmente, referência ao termo de recebimento original) quanto patrimoniado (nenhum dos dois)
- Elegibilidade do equipamento: precisa estar com status `allocated` (não `stock`, `maintenance` ou `retired`) e vinculado (`assigned_user_id`) ao mesmo usuário selecionado como devolvedor — `asset_return_term_error` valida isso na prévia e na criação
- Reserva própria (`inventory_return_terms.status` em `draft`/`emitted`) impede que o mesmo equipamento entre em dois termos de devolução simultâneos; `ensure_asset_not_reserved` (usado pela movimentação direta de devolução ao estoque) também passou a considerar essa reserva, além da de termos de recebimento
- Confirmação aplica `apply_return_to_stock` (mesma função usada pela devolução direta em `/api/inventory/assets/{id}/return-to-stock`) e grava movimentação `returned_to_stock`, sempre para o setor padrão ADCETEI
- Assinatura no DOCX: devolvedor assina primeiro, ADCETEI em segundo — ordem invertida em relação ao termo de recebimento, seguindo o padrão já usado nos termos de devolução manuais anteriores
- Geração de DOCX reaproveita os utilitários OOXML genéricos extraídos para `docx_utils.py` (manipulação de parágrafos/tabelas, paginação, reflow em duas páginas) — `delivery_terms_docx.py` e `return_terms_docx.py` só têm a lógica específica de cada template
- Tela `/inventario/termos` tem um alternador no topo ("Recebimento"/"Devolução"); cada lado é um componente próprio (`features/inventory/DeliveryTermsPanel.tsx` e `ReturnTermsPanel.tsx`). Na devolução, o servidor devolvedor é selecionado antes da busca de equipamento, que já vem filtrada aos itens alocados a ele

### Ações rápidas do detalhe do equipamento ↔ termos

A tela `/inventario/[id]` não chama mais `POST /api/inventory/assets/{id}/allocate` nem `.../return-to-stock` para as transições que envolvem uma pessoa. Os botões da barra de ações mudam de significado conforme o status do equipamento:

- Equipamento em `stock`: só aparece "Movimentar", que navega para `/inventario/termos?tab=delivery&asset_id={id}` com o equipamento já adicionado ao termo de recebimento — a entrega só se efetiva quando o termo é confirmado.
- Equipamento em `allocated`: só aparece "Devolver ao estoque", que navega para `/inventario/termos?tab=return&asset_id={id}` com o devolvedor (usuário atualmente vinculado) e o equipamento já pré-selecionados — a devolução só se efetiva quando o termo de devolução é confirmado.
- Equipamento em `maintenance`: "Devolver ao estoque" continua chamando a movimentação simples (`return-to-stock`) direto, sem termo — não existe pessoa/responsabilidade envolvida nessa transição (equipamento que sai de manutenção volta ao estoque), e nenhum dos dois tipos de termo cobre esse caso hoje.
- Realocar um equipamento já `allocated` para outra pessoa/setor deixou de ser uma ação direta de um clique: o caminho passa a ser devolver ao estoque (termo de devolução) e emitir um novo termo de recebimento para o novo responsável, preservando o rastro documental nas duas pontas.

Os endpoints simples `/allocate` e `/return-to-stock` continuam existindo no backend (usados por `scripts/regression-test.sh` e mantidos como via de correção administrativa), mas deixaram de ser o caminho principal da tela de equipamento — ver auditoria de arquitetura, item de conexão inventário↔termo.

Quando o cadastro administrativo não informa senha, o backend gera uma credencial aleatória que não é exibida nem registrada. A conta permanece bloqueada até uma futura redefinição administrativa.

Duas superfícies para equipamentos:

| Endpoint | Uso |
|----------|-----|
| `GET /api/assets` | Inventário administrativo completo (`assets.view`) |
| `GET /api/inventory/assets/ticket-options` | Contrato canônico para seleção resumida na abertura de chamado; usuário comum só vê vínculos próprios |
| `GET /api/assets/ticket-options` | Compatibilidade deprecated; delega para a mesma consulta e o mesmo payload do endpoint canônico |

A rota resumida antiga poderá ser removida depois que todas as instalações usarem o frontend modular e os logs confirmarem a ausência de integrações externas. `GET /api/assets` permanece separado porque a edição administrativa de chamados ainda consome seu contrato completo.

## Acesso remoto

Integração com MeshCentral via serviço interno `apps/mesh-bridge`. O Portal controla autorização, motivo e histórico; o MeshCentral continua sendo o motor do desktop remoto.

```text
Técnico -> Portal Web -> API FastAPI -> Mesh Bridge -> MeshCentral -> Agente
```

| Componente | Papel |
|------------|-------|
| Portal Web (`/acesso-remoto`) | Listagem, filtros, motivo e abertura do visualizador em nova aba |
| API (`/api/remote-access/*`) | Autenticação, permissões, auditoria, sessões e vínculo opcional com inventário/chamado |
| Mesh Bridge (`apps/mesh-bridge`) | `meshctrl`, cache de dispositivos e geração de login token |
| MeshCentral | Relay desktop e consentimento na máquina alvo |

Rotas da API:

- `GET /api/remote-access/devices` — listagem paginada (via bridge)
- `POST /api/remote-access/sessions` — cria sessão autorizada
- `POST /api/remote-access/sessions/connect` — cria sessão e gera URL em uma chamada
- `POST /api/remote-access/sessions/{id}/launch` — gera URL para sessão existente
- `POST /api/remote-access/sessions/{id}/close` — encerra sessão

Permissões: `remote_access.view`, `remote_access.connect`, `remote_access.manage`. O administrador recebe todas por padrão; o perfil técnico precisa de `view` e `connect` atribuídos manualmente.

Tabelas: `remote_device_links` (vínculo opcional com inventário) e `remote_access_sessions` (histórico de sessões).

### Integração com chamados

A tela de detalhe do chamado (`/chamados/[id]`) mostra um botão "Abrir acesso remoto" (visível com `remote_access.connect`, somente depois que o chamado tem responsável atribuído) que leva para `/acesso-remoto?ticket_id=<id>&asset_id=<id>` — o `asset_id` só é enviado quando o chamado já tem equipamento vinculado. A tela de acesso remoto lê esses parâmetros (`RemoteAccessContent`, envolvida em `SearchParamsSuspense`) e:

- pré-preenche "Chamado relacionado" e "Equipamento no inventário" ao abrir o diálogo de conexão, dispensando digitação manual do número do chamado;
- abre o diálogo automaticamente quando existe exatamente um computador do MeshCentral já vinculado ao equipamento do chamado e ele está online.

Ao encerrar uma sessão vinculada a um chamado (`POST /sessions/{id}/close`), a API registra automaticamente um evento público na linha do tempo do chamado (`TicketComment`, `event_type="event"`) citando o equipamento quando houver vínculo. O registro é *best-effort*: uma falha ao comentar no chamado é logada, mas nunca impede o encerramento da sessão em si.

O bridge consulta dispositivos com `meshctrl listdevices --json`, grava a saída em arquivo temporário (evita truncamento por pipe) e mantém cache em memória (`MESH_DEVICES_CACHE_TTL_MS`, padrão 30s). A URL de sessão usa login token AES-GCM:

```text
{publicUrl}/?login={loginToken}&node={nodeId}&gotonode={nodeId}&viewmode=11&hide=31
```

Operação, variáveis de ambiente, validação e troubleshooting: [ACESSO-REMOTO.md](./ACESSO-REMOTO.md).

## Chamados

- Paginação e resumo agregado calculados no banco (`GET /api/tickets`);
- datas em UTC na API, exibição em `America/Sao_Paulo` no frontend;
- `form_schema` legado (lista de strings) e configurável (objetos com `key`, `type`, `required`);
- respostas em `tickets.form_data`, snapshot em `form_schema_snapshot`.

### Ciclo de vida

Status possíveis (`app/domain.py`): `new` → `assigned` → `in_progress` → `waiting_requester` → `resolved` → `closed`, com `cancelled` disponível a partir de qualquer estado não finalizado.

- `waiting_requester` ("Aguardando solicitante") pausa a cobrança de prazo — fica fora de `OVERDUE_ELIGIBLE_STATUSES`, embora continue contando como aberto (`OPEN_STATUSES`) para as filas do técnico;
- `resolved` exige responsável e mensagem de resolução, e **não é um estado final** — pode ser confirmado (`closed`, sem exigir nova mensagem) ou reaberto livremente, já que o solicitante ainda não confirmou;
- `closed`/`cancelled` são finais, mas podem ser reabertos dentro de `REOPEN_WINDOW_DAYS` (7 dias corridos a partir de `closed_at`) enviando `{"status": "assigned"}` (ou outro status aberto) via `PATCH /api/tickets/{id}` — a API detecta que é uma reabertura (`can_reopen`/`reopen_ticket` em `services/tickets_service.py`) e registra um evento no histórico;
- se o **solicitante** responde publicamente a um chamado `resolved`/`closed`/`cancelled` dentro da janela de reabertura, o chamado reabre automaticamente (mesmo mecanismo, acionado em `POST /tickets/{id}/comments`) — não existe reabertura "manual" para quem não é responsável ou triagem;
- o painel de atendimento (`TicketSidePanel`) mostra apenas as ações válidas para o status atual (iniciar, aguardar solicitante, retomar, resolver, encerrar, cancelar, reabrir), calculadas no frontend a partir do mesmo conjunto de regras.

## Mensagens

Conversas diretas (1:1) entre qualquer par de usuários ativos do portal, sem exigir permissão além de estar autenticado — é um canal de comunicação geral da equipe, não vinculado a chamados.

- `GET /api/chat/contacts` — diretório de usuários ativos (exceto o próprio), com busca por nome/setor/secretaria; não depende de `users.view`, propositalmente aberto a todos os perfis
- `GET /api/chat/conversations` — uma linha por contato com quem já houve troca de mensagens, com última mensagem e contagem de não lidas, ordenado pela mais recente
- `GET /api/chat/messages/{contact_id}` — histórico da conversa; aceita `after_id` para buscar apenas mensagens novas (usado no polling do frontend)
- `POST /api/chat/messages` — envia mensagem para outro usuário ativo
- `POST /api/chat/messages/{contact_id}/read` — marca como lida toda a conversa com aquele contato
- `GET /api/chat/unread-count` — total de mensagens não lidas do usuário, usado no selo do item de navegação

Sem WebSocket: o frontend busca mensagens novas por polling (a cada 4s na conversa aberta, a cada 10s na lista de conversas; o selo de não lidas no menu lateral verifica a cada 15s). Optou-se por esse caminho por ser consistente com o restante do portal (que já é 100% REST/polling) e por não introduzir gerenciamento de conexão persistente para um volume de uso interno pequeno; migrar pontos específicos para WebSocket depois é incremental caso o uso justifique.

Tabela: `chat_messages` (`sender_id`, `recipient_id`, `body`, `created_at`, `read_at`).

## Schema do banco

Alembic é a única autoridade do schema. A baseline completa `20260717_0001` fica em `apps/api/alembic` e cria o schema do monólito modular em um banco vazio. A API não cria tabelas nem altera bancos silenciosamente durante o startup.

Bancos anteriores não são adaptados no lugar. O fluxo oficial é preservar um backup/exportação, criar um banco vazio, aplicar as migrations e criar o administrador. A importação futura de dados selecionados será feita por um script separado, fora desta entrega.

## Implantação em VM

```text
navegador -> gateway:80 -> web:3000
                       -> api:8000 -> database:5432
                                    -> mesh-bridge:8080 -> MeshCentral (HTTPS/WSS)
```

Com acesso remoto habilitado (`REMOTE_ACCESS_ENABLED=true`), a API conversa com o mesh-bridge na rede interna do Compose. O bridge não deve ser exposto na internet.

O gateway Nginx entrega o frontend e encaminha `/api` internamente. Variáveis sensíveis vêm do `.env` da VM (`POSTGRES_PASSWORD`, `SECRET_KEY`, SMTP, `PUBLIC_APP_URL`).

- `SEED_DEMO_DATA` controla criação de dados demo;
- `SHOW_DEMO_USERS` controla atalhos no login;
- sem seed, administrador inicial via `python -m app.create_admin`;
- a API executa `alembic upgrade head` antes de iniciar no container;
- a primeira implantação desta versão exige banco PostgreSQL vazio; o banco de testes anterior deve ser exportado e preservado até a validação da futura importação.
