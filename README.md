# Portal Interno ADCETEI

Hub operacional modular da ADCETEI (Prefeitura de Cabo Frio): chamados técnicos, inventário de equipamentos, catálogo de serviços, usuários e cadastro por e-mail institucional verificado. Novos módulos (impressoras, memorandos, etc.) entram sem alterar a estrutura central.

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Organização do monólito modular, pastas do backend e frontend |
| [docs/VALIDACAO.md](docs/VALIDACAO.md) | Comandos de verificação e última rodada de testes |
| [docs/CORRECAO-NPM.md](docs/CORRECAO-NPM.md) | Recuperação de instalação npm |
| [docs/README.md](docs/README.md) | Índice da documentação |

## Administração

A interface administrativa permite:

- criar, editar, bloquear e reativar contas locais;
- marcar e-mails como verificados ou reenviar verificação em casos excepcionais;
- cadastrar, editar, vincular e baixar equipamentos sem apagar o histórico;
- criar, editar, arquivar e reativar serviços do catálogo;
- configurar campos dinâmicos dos formulários de abertura;
- definir permissões de cada perfil;
- consultar a auditoria de alterações em usuários, equipamentos, catálogo e perfis.

As permissões são verificadas novamente pela API. Permissões de gerenciamento incluem automaticamente a permissão de consulta necessária. O último administrador ativo não pode ser removido ou bloqueado.

## Stack

- Next.js, React, TypeScript e Tailwind CSS;
- componentes próprios e Radix UI;
- FastAPI, SQLAlchemy e Pydantic;
- SQLite no ambiente local;
- PostgreSQL no Docker;
- JWT com senha local e verificação obrigatória de e-mail institucional.

O projeto usa um monólito modular. Não há dependência de MUI.

```text
apps/
├── api/app/          # FastAPI — routers/, serializers/, services/
└── web/
    ├── app/          # rotas Next.js (orquestradoras)
    ├── features/     # UI por domínio (tickets, inventory, admin, dashboard)
    ├── components/   # UI compartilhada
    └── lib/          # api/, types/, format, permissions
```

Detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Executar localmente

```bash
chmod +x iniciar-local.sh scripts/*.sh
./iniciar-local.sh
```

Endereços:

- portal: `http://localhost:3000`;
- documentação da API: `http://localhost:8000/docs`;
- health check: `http://localhost:8000/api/health`.

O script cria a venv quando necessário, instala dependências e executa o Uvicorn por meio de `python -m uvicorn`. Isso evita problemas quando o projeto é movido ou renomeado.

## Configuração

Copie e adapte `apps/api/.env.example`.

### Autenticação institucional

O portal usa `AUTH_MODE=email`. O cadastro público aceita somente e-mails no formato:

```text
usuario@secretaria.cabofrio.rj.gov.br
```

Exemplos válidos incluem `miguel.teixeira@adcetei.cabofrio.rj.gov.br` e `joao.silva@educacao.cabofrio.rj.gov.br`. E-mails `@cabofrio.rj.gov.br`, pessoais ou de outros domínios são recusados.

Novas contas públicas nascem como `Usuário`, sem e-mail verificado. O usuário só consegue entrar depois de confirmar o link enviado por SMTP. Técnico e Administrador continuam sendo atribuídos manualmente por um administrador.

Variáveis principais:

```env
AUTH_MODE=email
INSTITUTIONAL_EMAIL_PATTERN=^[^@\s]+@[a-z0-9-]+\.cabofrio\.rj\.gov\.br$
EMAIL_VERIFICATION_EXPIRE_MINUTES=60
PUBLIC_APP_URL=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_USE_TLS=true
```

### Dados de demonstração

```env
SEED_DEMO_DATA=true
```

- `true`: cria os dados demonstrativos somente quando o banco ainda não possui usuários;
- `false`: não cria usuários, chamados, equipamentos ou catálogo de demonstração;
- quando a variável não é definida, o seed é habilitado apenas em `local`, `development` ou `dev`;
- ambientes não locais ficam sem seed por padrão;
- dados existentes nunca são apagados automaticamente.

O seed local cobre o fluxo operacional: usuários/chamados, catálogos do inventário, fornecedor IART, contratos, setores, equipamentos em estoque, alocados, em manutenção e baixados. A massa usa uma amostra curta baseada na exportação real `inventario_adcetei_2026-07-08.xlsx`, suficiente para testar emissão de termo, validação por número de série, alocação e item usado devolvido ao estoque.

O `iniciar-local.sh` usa a configuração de `apps/api/.env` quando esse arquivo existir. Sem arquivo, os padrões locais mantêm os dados de demonstração habilitados.

## Migrações de banco

O schema oficial é gerenciado por Alembic em `apps/api/alembic`. O `./iniciar-local.sh` instala as dependências e executa `alembic upgrade head` antes de iniciar a API.

### Instalação limpa

```bash
cd apps/api
alembic upgrade head
```

Depois crie o primeiro administrador quando o seed estiver desabilitado:

```bash
python -m app.create_admin \
  --full-name "Administrador ADCETEI" \
  --email "administrador@adcetei.cabofrio.rj.gov.br"
```

### Primeira adoção de banco existente

Nunca execute `stamp` em banco desconhecido. Para uma VM já em uso:

1. faça backup com `pg_dump` ou `./scripts/backup-postgres.sh`;
2. pare a API;
3. valide o schema:

```bash
cd apps/api
python -m app.schema_adoption
```

4. corrija qualquer divergência indicada pelo verificador;
5. marque a baseline manualmente:

```bash
alembic stamp 20260717_0001
alembic upgrade head
alembic current
```

6. inicie a API;
7. valide login, chamados, inventário e termos.

O verificador apenas lê o banco. Ele não altera dados e não executa `stamp`.

### Novas migrations

```bash
cd apps/api
alembic revision --autogenerate -m "descricao curta"
```

Revise o arquivo gerado antes de aplicar: ordem das tabelas, FKs, índices, constraints únicas e compatibilidade SQLite/PostgreSQL. Depois rode:

```bash
alembic upgrade head
alembic check
```

Não edite migrations já aplicadas em ambiente compartilhado. Não use `stamp` para pular uma migration normal. Downgrade nunca é executado automaticamente em produção; em falha de adoção, pare a aplicação, restaure o backup e investigue a migration.

## Contas de demonstração

Disponíveis somente quando `SEED_DEMO_DATA=true`:

| Perfil | Usuário | Senha |
|---|---|---|
| Administrador | `admin@adcetei.cabofrio.rj.gov.br` | `admin123` |
| Técnico | `maiana.ignacio@adcetei.cabofrio.rj.gov.br` | `123456` |
| Técnico | `lucas.martins@adcetei.cabofrio.rj.gov.br` | `123456` |
| Usuário | `kathlelyn.abreu@sedec.cabofrio.rj.gov.br` | `123456` |

## Segurança do inventário

O Inventário está sendo modularizado em etapas. A tabela `assets` continua sendo a base dos equipamentos por compatibilidade com chamados e as rotas atuais de assets seguem disponíveis durante a transição.

Direção planejada do módulo: fundação modular, cadastros base, evolução de equipamentos, cadastro individual, movimentações, entrada em lote por leitura de série e importação por planilha.

Os cadastros base já existem no backend para secretarias, setores, fornecedores, contratos, tipos de equipamento, fabricantes e modelos. Setores pertencem a uma secretaria; contratos pertencem a um fornecedor; modelos pertencem a fabricante e tipo. Eles usam `inventory.view` para consulta e `inventory.manage_catalogs` para criação/edição.

A hierarquia organizacional conhecida é `Secretaria de Gestão e Inovação (SGI) → ADCETEI`. A compatibilidade de bancos antigos vincula automaticamente somente o setor ADCETEI; setores sem classificação permanecem sem secretaria até revisão administrativa.

`assets` também foi evoluído para o contrato modular em `/api/inventory/assets`, com número de série como identificação principal, vínculos opcionais aos cadastros base, datas de recebimento/entrega e observações. Os campos e rotas legadas de assets continuam preservados temporariamente.

A Parte 6 adicionou histórico e movimentações em `asset_movements`. Alocação, troca de responsável, devolução ao estoque e manutenção registram ator, data operacional, setor/responsável/status de origem e destino. Entrada em lote por leitura de série e importação por planilha continuam planejadas para etapas posteriores.

A Parte 7 adicionou entrada em lote por leitura/digitação de números de série. O fluxo cria todos os itens como estoque ADCETEI, sem responsável e sem data de envio, registrando movimento inicial `created` para cada equipamento. Importação por planilha continua para etapa posterior.

A Parte 8 adicionou a tela `/administracao/base-cadastros` para gerenciar a base usada por inventário, usuários e termos. O acesso exige `inventory.manage_catalogs`. A rota antiga `/inventario/cadastros` redireciona para essa base administrativa.

O fluxo de termos de recebimento fica separado em `/inventario/termos`. Ele sugere o próximo número, usa contrato cadastrado vinculado a fornecedor, preenche o destino como `Secretaria - Setor`, valida os números de série antes da emissão, emite o DOCX oficial a partir do template cadastrado na API, permite cancelar termo aberto e só altera o inventário quando a entrega assinada é confirmada. A confirmação aloca todos os itens do termo para o setor/usuário e registra uma movimentação por equipamento. Equipamentos também têm campo de especificações, usado na relação do termo. Movimentações diretas usam uma ação única para setor/responsável e bloqueiam responsável fora do setor selecionado.

Enquanto um termo está aberto (`draft` ou `emitted`), seus equipamentos ficam reservados e não podem ser editados ou movimentados. A confirmação revalida estoque, lotação e datas e aplica todos os itens em uma única transação; o cancelamento libera a reserva.

O setor padrão `ADCETEI` é protegido no backend: não pode ser renomeado nem desativado via API.

`GET /api/assets` exige a permissão `assets.view`.

A abertura de chamado usa o contrato canônico `GET /api/inventory/assets/ticket-options`, que retorna somente:

- `id`;
- `name`;
- `asset_type`;
- `patrimony`.

Usuários comuns recebem apenas equipamentos vinculados ao próprio usuário. O backend também impede que um usuário envie manualmente o identificador de um equipamento pertencente a outra pessoa.

`GET /api/assets/ticket-options` permanece temporariamente como alias deprecated e delega para a mesma consulta e serialização. Ele poderá ser removido quando todas as instalações estiverem com o frontend modular e os logs confirmarem que não existem integrações externas usando a rota antiga. A listagem completa `GET /api/assets` continua necessária para a edição de chamados por perfis com `assets.view`.

Detalhes de equipamento dentro de chamados do usuário não incluem IP, serial, sistema operacional ou usuário vinculado.

## Chamados

### Paginação

`GET /api/tickets` aceita:

- `page`;
- `page_size`;
- `status`;
- `priority`;
- `assignee_id`;
- `search`.

A resposta inclui `total`, página atual, tamanho da página e um resumo agregado:

- novos;
- sem responsável;
- alta ou crítica;
- aguardando solicitante.

Os totais são calculados no banco, respeitando perfil e filtros, sem carregar todos os registros no frontend.

### Datas

- o backend trabalha em UTC;
- a API serializa datas com `Z` ou offset explícito;
- o frontend exibe datas em `America/Sao_Paulo`;
- datas relativas e absolutas usam os mesmos valores normalizados.

### Formulários do catálogo

`form_schema.fields` aceita o formato legado:

```json
{"fields": ["computer", "symptoms"]}
```

Também aceita campos configuráveis:

```json
{
  "fields": [
    {
      "key": "software_name",
      "label": "Nome do sistema",
      "type": "text",
      "required": true,
      "placeholder": "Nome e versão",
      "max_length": 180
    }
  ]
}
```

Tipos suportados:

- `text`;
- `email`;
- `textarea`;
- `select`;
- `date`.

As respostas são validadas no frontend e no backend, salvas em `tickets.form_data` e exibidas separadamente da descrição original.

## Mudança de banco

Novas mudanças de schema devem ser feitas por Alembic. A baseline atual é `20260717_0001` e representa o schema da `main` após a unificação dos endpoints de equipamentos.

`database.ensure_schema_compatibility()` permanece como fallback temporário para instalações legadas durante uma versão de transição. Ele não executa `stamp` e não deve receber novas alterações de schema.

## Sessão expirada

Ao receber `401` em uma requisição autenticada, o cliente:

1. remove token e usuário do armazenamento;
2. dispara um único evento global de sessão expirada;
3. atualiza imediatamente o contexto de autenticação;
4. oculta a estrutura protegida;
5. redireciona para `/login`;
6. mostra `Sua sessão expirou. Entre novamente.`.

Erros diferentes de `401` continuam sendo tratados pela tela que iniciou a operação.

## Validação

```bash
apps/api/.venv/bin/python -m compileall apps/api/app
bash -n iniciar-local.sh resetar-dados.sh scripts/*.sh
./scripts/regression-test.sh
./scripts/smoke-test.sh
./scripts/alembic-self-check.sh

cd apps/web
npm run typecheck
npm run build
cd ../..

docker compose config --quiet
docker compose build
```

Os testes de Alembic, regressão e smoke usam bancos SQLite temporários e são removidos ao final. Nenhum chamado de teste é inserido no banco local.

Resultados e cobertura detalhada estão em [docs/VALIDACAO.md](docs/VALIDACAO.md).

## Testar em uma VM

```bash
cp .env.vm.example .env
nano .env
chmod +x scripts/*.sh
./scripts/iniciar-vm.sh
```

Antes de iniciar, substitua no `.env`:

- `POSTGRES_PASSWORD`;
- `SECRET_KEY`;
- `CORS_ORIGINS` pelo IP ou DNS da VM;
- `PUBLIC_APP_URL` pelo endereço público do portal;
- configurações SMTP para envio de verificação.

Use pelo menos 12 caracteres na senha do PostgreSQL e 32 caracteres na `SECRET_KEY`. O script interrompe a implantação quando encontra placeholders ou segredos fracos.

O ambiente de VM usa um único endereço público. O Nginx entrega o frontend e encaminha `/api` internamente, evitando que o navegador tente acessar `localhost` da máquina do usuário. PostgreSQL e FastAPI não publicam portas diretamente.

O container da API executa `alembic upgrade head` antes do Uvicorn. Na primeira implantação com um banco PostgreSQL já existente, faça a adoção manual com backup e `alembic stamp 20260717_0001` antes de subir o novo fluxo automático.

Com `SEED_DEMO_DATA=false`, crie o primeiro administrador:

```bash
docker compose exec api python -m app.create_admin \
  --full-name "Administrador ADCETEI" \
  --email "administrador@adcetei.cabofrio.rj.gov.br"
```

Para uma homologação isolada, também é possível habilitar temporariamente:

```env
SEED_DEMO_DATA=true
SHOW_DEMO_USERS=true
```

Depois do primeiro teste, volte ambos para `false` e recrie o frontend com `./scripts/iniciar-vm.sh`.

### Serviços

- `gateway`: entrada HTTP e proxy interno;
- `web`: Next.js;
- `api`: FastAPI;
- `database`: PostgreSQL 16.

Os diretórios `node_modules`, `.next`, `.venv` e bancos locais são excluídos dos contextos Docker.

### Backup

```bash
./scripts/backup-postgres.sh
```

Os arquivos são gravados em `backups/` com permissão restrita. Para ambiente definitivo, automatize a cópia para armazenamento externo à VM.

### Produção

O Compose entregue é adequado para homologação em rede controlada. Antes de uso definitivo, publique o gateway atrás de HTTPS, configure SMTP, backup externo, monitoramento e política de atualização.

## Limitações atuais

- AD/LDAP ficou fora do fluxo operacional atual e pode ser reavaliado apenas como integração futura;
- não há renovação silenciosa de JWT;
- ainda não há teste E2E automatizado em navegador;
- anexos reais permanecem fora do MVP;
- inventário automático depende de GLPI Agent, outra ferramenta de inventário ou agente futuro.
