# Arquitetura do Portal Interno ADCETEI

## Visão geral

O sistema é um monólito modular:

```text
Portal Interno ADCETEI
├── Núcleo
│   ├── autenticação
│   ├── usuários e perfis
│   ├── sessão
│   └── auditoria
├── Chamados
│   ├── catálogo
│   ├── abertura
│   ├── triagem
│   ├── histórico
│   └── notas internas
├── Inventário
│   ├── consulta administrativa
│   └── opções resumidas para chamados
└── Administração
    ├── usuários
    ├── catálogo
    ├── equipamentos
    ├── perfis e permissões
    ├── auditoria
    └── integração LDAP preparada
```

Essa organização mantém a operação simples e permite separar regras sem introduzir microsserviços prematuramente.

## Frontend

- Next.js e React;
- TypeScript;
- Tailwind CSS;
- Radix Dialog;
- componentes próprios;
- cliente HTTP central em `apps/web/lib/api.ts`;
- estado de autenticação em `components/AuthProvider.tsx`.

### Sessão

O cliente HTTP detecta `401` apenas em requisições que possuíam token. Ele limpa o armazenamento e emite um evento global. O `AuthProvider` recebe esse evento, remove o usuário do estado e redireciona para o login.

Um bloqueio impede múltiplos redirecionamentos simultâneos quando várias chamadas retornam `401`.

### Sistema visual

Os tokens institucionais e semânticos ficam em `app/globals.css`:

- azul profundo para navegação;
- azul médio para ações;
- ciano como apoio;
- verde para sucesso;
- âmbar para atenção;
- vermelho para crítico;
- superfícies, bordas, foco, raios e sombras.

Status e prioridades usam texto e ícones, além de cor. Métricas possuem acentos e fundos de ícone por contexto, sem hover em elementos não interativos.

## Backend

- FastAPI;
- SQLAlchemy;
- Pydantic;
- JWT;
- SQLite local;
- PostgreSQL no Docker;
- LDAP3 para integração com Active Directory.

## Autorização administrativa

As ações são protegidas por permissões persistidas em `role_configs`, e não apenas pelo nome do perfil. O administrador possui acesso completo obrigatório. Dependências são aplicadas automaticamente:

- triagem inclui visão geral de chamados, usuários e inventário;
- gestão de usuários inclui consulta de usuários;
- gestão de equipamentos inclui consulta do inventário.

Mudanças em usuários, equipamentos, catálogo e perfis são registradas em `audit_logs`. Exclusões destrutivas não são usadas: contas são bloqueadas, serviços são arquivados e equipamentos são baixados.

O mapeamento LDAP é configurado por perfil. Grupos duplicados são rejeitados e a prioridade de avaliação é administrador, helpdesk, técnico e solicitante.

## Autenticação

O fluxo é determinado exclusivamente por `AUTH_MODE`:

```text
local  -> consulta senha local
ldap   -> consulta somente LDAP
hybrid -> tenta senha local e depois LDAP
```

Em modo LDAP, a senha local nunca é verificada antes do diretório. Usuários provisionados pelo LDAP são criados ou atualizados no banco local somente após autenticação válida. Usuários inativos permanecem bloqueados.

## Seed

`SEED_DEMO_DATA` controla a criação dos dados de demonstração.

O seed:

- só roda quando habilitado;
- só insere dados quando não há usuários;
- não remove nem substitui dados existentes;
- fica desabilitado por padrão fora de ambientes locais ou de desenvolvimento.

## Inventário

Existem duas superfícies:

### Inventário administrativo

`GET /api/assets`

Disponível para:

- administrador;
- helpdesk;
- técnico.

Retorna dados completos, como IP, serial, sistema operacional, localização e usuário.

### Opções para abertura

`GET /api/assets/ticket-options`

Retorna somente os campos necessários para seleção. Solicitantes recebem exclusivamente ativos vinculados ao próprio usuário. A criação do chamado repete essa validação no backend para impedir manipulação manual do identificador.

## Paginação

A consulta de chamados aplica primeiro:

1. visibilidade do perfil;
2. busca;
3. status;
4. prioridade;
5. responsável.

O banco calcula separadamente:

- total da consulta;
- registros da página;
- novos;
- sem responsável;
- alta ou crítica;
- aguardando solicitante.

O frontend mantém o conteúdo anterior durante atualizações e usa uma sequência de requisições para ignorar respostas antigas.

## Datas

Datas são geradas e comparadas em UTC. Valores recuperados do SQLite sem `tzinfo` são interpretados como UTC antes da serialização.

A API retorna ISO 8601 com `Z`. O frontend usa explicitamente `America/Sao_Paulo` para exibição.

O indicador de resolvidos no dia usa os limites do dia de São Paulo convertidos para UTC.

## Formulários dinâmicos

`catalog_forms.py` normaliza tanto a lista legada de nomes quanto objetos configuráveis.

O backend:

- permite apenas campos previstos pelo serviço;
- valida obrigatoriedade, tamanho e opções;
- valida formato real de e-mail e datas ISO;
- rejeita chaves desconhecidas;
- persiste respostas em `Ticket.form_data`;
- associa o chamado ao serviço por `service_id`;
- preserva o schema original em `form_schema_snapshot`.

O frontend gera os controles com base no schema e mantém a descrição geral como campo obrigatório independente.

## Compatibilidade de banco

`database.ensure_schema_compatibility()` adiciona `tickets.form_data`, `tickets.form_schema_snapshot` e `tickets.service_id` quando ainda não existem.

Essa medida evita exigir reset do banco atual. É uma ponte temporária; novas evoluções de schema devem usar Alembic.

## Segurança do chamado

- solicitante acessa somente seus chamados;
- técnico acessa somente chamados atribuídos;
- técnico altera apenas status permitidos;
- solicitante não define título ou prioridade;
- notas internas são filtradas no backend;
- alterações administrativas geram eventos públicos com autoria;
- helpdesk e administrador podem vincular qualquer equipamento na triagem.

## Implantação em VM

O Compose publica somente o gateway Nginx. O frontend chama a API pelo caminho relativo `/api`, e o gateway encaminha a requisição para o FastAPI na rede interna.

```text
navegador -> gateway:80 -> web:3000
                       -> api:8000 -> database:5432
```

API e PostgreSQL ficam sem portas públicas. Senhas, chave JWT, modo de autenticação e LDAP são definidos pelo `.env` da VM e não permanecem fixos no Compose.

O seed e os atalhos de login são independentes:

- `SEED_DEMO_DATA` controla a criação dos registros;
- `SHOW_DEMO_USERS` controla somente a exibição dos atalhos no login;
- `NEXT_PUBLIC_APP_ENV` identifica local, homologação ou produção na interface.

Sem seed, o administrador inicial é criado explicitamente pelo módulo `app.create_admin`.
