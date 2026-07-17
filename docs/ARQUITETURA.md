# Arquitetura do Portal Interno ADCETEI

## Visão geral

O sistema é um **hub operacional modular** da ADCETEI — monólito em execução, separado por domínio no código. Chamados e inventário são módulos maduros; impressoras, memorandos e catálogo de VMs permanecem planejados.

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
├── Inventário
│   ├── cadastros base (fornecedor, tipo, fabricante, modelo, setor)
│   ├── equipamentos e movimentações
│   ├── entrada em lote por série
│   ├── termos de recebimento e confirmação de entrega
│   └── opções resumidas para chamados
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
| `main.py` | Factory FastAPI, CORS, `include_router`, startup (schema, seed) |
| `routers/auth.py` | Login, cadastro, verificação de e-mail |
| `routers/tickets.py` | Chamados e dashboard |
| `routers/users_assets.py` | Usuários, assets legados, opções para chamados |
| `routers/admin/` | Usuários admin, assets, catálogo, perfis, auditoria |
| `routers/inventory/` | Meta, equipamentos modulares, cadastros base |
| `serializers/` | Serialização de users, assets e tickets |
| `services/tickets_service.py` | Regras de negócio de chamados |
| `admin_api.py` | Reexport: `from .routers.admin import router` |
| `inventory_api.py` | Reexport: `from .routers.inventory import router` |
| `inventory_service.py` | Regras de inventário e movimentações |
| `inventory_helpers.py`, `admin_helpers.py` | Helpers compartilhados dos routers |
| `schemas.py` | Schemas Pydantic (monolítico de propósito — evita imports circulares) |
| `models.py`, `database.py`, `permissions.py` | Persistência, migração compatível e RBAC |

Rotas públicas principais:

- `/api/auth/*`, `/api/tickets/*`, `/api/users`, `/api/assets/*`
- `/api/admin/*`
- `/api/inventory/*`

### Frontend (`apps/web/`)

| Caminho | Papel |
|---------|--------|
| `app/` | Rotas Next.js — páginas **orquestradoras** (estado, fetch, permissões) |
| `features/<domínio>/` | Composição de UI por módulo (`admin`, `dashboard`, `inventory`, `tickets`) |
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
| `/inventario`, `/inventario/[id]`, `/inventario/lote`, `/inventario/novo` | `features/inventory/*` |
| `/inventario/termos` | Termos de recebimento e confirmação de entrega |
| `/administracao/base-cadastros`, `/administracao/catalogo`, `/administracao/usuarios` | `features/admin/*` |
| `/administracao/perfis`, `/administracao/auditoria` | Inline (telas menores) |

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
- Hierarquia conhecida: `Secretaria de Gestão e Inovação (SGI) → ADCETEI`; a ponte de compatibilidade não classifica automaticamente outros setores
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

Quando o cadastro administrativo não informa senha, o backend gera uma credencial aleatória que não é exibida nem registrada. A conta permanece bloqueada até uma futura redefinição administrativa.

Duas superfícies para equipamentos:

| Endpoint | Uso |
|----------|-----|
| `GET /api/assets` | Inventário administrativo completo (`assets.view`) |
| `GET /api/inventory/assets/ticket-options` | Contrato canônico para seleção resumida na abertura de chamado; usuário comum só vê vínculos próprios |
| `GET /api/assets/ticket-options` | Compatibilidade deprecated; delega para a mesma consulta e o mesmo payload do endpoint canônico |

A rota resumida antiga poderá ser removida depois que todas as instalações usarem o frontend modular e os logs confirmarem a ausência de integrações externas. `GET /api/assets` permanece separado porque a edição administrativa de chamados ainda consome seu contrato completo.

## Chamados

- Paginação e resumo agregado calculados no banco (`GET /api/tickets`);
- datas em UTC na API, exibição em `America/Sao_Paulo` no frontend;
- `form_schema` legado (lista de strings) e configurável (objetos com `key`, `type`, `required`);
- respostas em `tickets.form_data`, snapshot em `form_schema_snapshot`.

## Compatibilidade de banco

Alembic é o caminho oficial para novas mudanças de schema. A baseline `20260717_0001` fica em `apps/api/alembic` e cobre o schema atual completo do monólito modular.

`database.ensure_schema_compatibility()` permanece como fallback temporário para bancos legados ainda não adotados. Ele corrige diferenças históricas conhecidas sem apagar dados, mas não executa `stamp` e não deve receber novas alterações de schema. Depois que os ambientes estiverem validados e marcados no Alembic, os blocos legados poderão ser removidos em uma versão dedicada.

## Implantação em VM

```text
navegador -> gateway:80 -> web:3000
                       -> api:8000 -> database:5432
```

O gateway Nginx entrega o frontend e encaminha `/api` internamente. Variáveis sensíveis vêm do `.env` da VM (`POSTGRES_PASSWORD`, `SECRET_KEY`, SMTP, `PUBLIC_APP_URL`).

- `SEED_DEMO_DATA` controla criação de dados demo;
- `SHOW_DEMO_USERS` controla atalhos no login;
- sem seed, administrador inicial via `python -m app.create_admin`;
- a API executa `alembic upgrade head` antes de iniciar no container;
- bancos PostgreSQL existentes precisam de backup, verificação por `python -m app.schema_adoption` e `alembic stamp 20260717_0001` antes da primeira subida com Alembic.
