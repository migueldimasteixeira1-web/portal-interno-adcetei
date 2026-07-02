# Portal Interno ADCETEI

Portal interno da Prefeitura de Cabo Frio para abertura, triagem e acompanhamento de chamados técnicos, com inventário básico, catálogo de serviços, usuários e cadastro por e-mail institucional verificado.

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

## Executar localmente

```bash
cd "/home/dimas/Projetos/Portal Interno ADCETEI"
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

O `iniciar-local.sh` usa a configuração de `apps/api/.env` quando esse arquivo existir. Sem arquivo, os padrões locais mantêm os dados de demonstração habilitados.

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

Os cadastros base do inventário já existem no backend para fornecedores, tipos de equipamento, fabricantes, modelos e setores. Eles usam `inventory.view` para consulta e `inventory.manage_catalogs` para criação/edição, ainda sem vínculo direto com `Asset` e sem tela própria.

`GET /api/assets` exige a permissão `assets.view`.

A abertura de chamado usa `GET /api/assets/ticket-options`, que retorna somente:

- `id`;
- `name`;
- `asset_type`;
- `patrimony`.

Usuários comuns recebem apenas equipamentos vinculados ao próprio usuário. O backend também impede que um usuário envie manualmente o identificador de um equipamento pertencente a outra pessoa.

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

Foi adicionada a coluna JSON `tickets.form_data`.

Na inicialização, a aplicação detecta bancos existentes e adiciona, sem apagar registros:

- `tickets.form_data`;
- `tickets.form_schema_snapshot`;
- `tickets.service_id`.

Novos chamados preservam uma cópia do formulário usado na abertura. Assim, alterações futuras no catálogo não mudam os rótulos e campos do histórico. A compatibilidade funciona no SQLite e no PostgreSQL atual. Antes de ampliar o número de migrações, deve-se adotar Alembic.

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

cd apps/web
npm run typecheck
npm run build
cd ../..

docker compose config --quiet
docker compose build
```

Os testes de regressão e smoke usam bancos SQLite temporários e são removidos ao final. Nenhum chamado de teste é inserido no banco local.

Resultados desta rodada estão registrados em `VALIDACAO.md`.

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
- ainda não há Alembic;
- não há renovação silenciosa de JWT;
- ainda não há teste E2E automatizado em navegador;
- anexos reais permanecem fora do MVP;
- inventário automático depende de GLPI Agent, outra ferramenta de inventário ou agente futuro.
