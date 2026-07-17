# Validação técnica

## Última rodada

**Data:** 17 de julho de 2026
**Branch:** `chore/alembic-baseline`
**Resultado:** todos os checks abaixo aprovados.

## Comandos

```bash
# Backend
apps/api/.venv/bin/python -m compileall apps/api/app
bash -n iniciar-local.sh resetar-dados.sh scripts/*.sh
./scripts/alembic-self-check.sh
./scripts/regression-test.sh
./scripts/smoke-test.sh
./scripts/delivery-term-self-check.sh

cd apps/api
alembic heads
alembic history
alembic current
alembic check
cd ../..

# Frontend
cd apps/web
npm run typecheck
npm run build
cd ../..

# Docker/VM
docker compose config --quiet
docker compose build api
```

Os testes `alembic-self-check.sh`, `regression-test.sh` e `smoke-test.sh` usam SQLite temporário e **não alteram** o banco local. Os comandos avulsos de Alembic devem ser executados com `DATABASE_URL` apontando para banco temporário quando forem validação local.

## Resultados (17 jul 2026)

| Check | Status |
|-------|--------|
| `./scripts/alembic-self-check.sh` | OK |
| SQLite vazio com `alembic upgrade head` repetido | OK |
| Adoção de banco existente compatível com `stamp` manual | OK |
| Recusa de banco incompleto sem `alembic_version` | OK |
| `alembic check` em banco temporário atualizado | OK |
| `compileall` Python | OK |
| Sintaxe dos scripts (`bash -n`) | OK |
| `./scripts/regression-test.sh` (9 etapas) | OK |
| `./scripts/smoke-test.sh` | OK |
| `./scripts/delivery-term-self-check.sh` | OK |
| `npm run typecheck` | OK |
| `npm run build` (23 rotas) | OK |
| PostgreSQL temporário com Docker | OK |
| API iniciada contra PostgreSQL temporário | OK |
| `docker compose config --quiet` com env temporário | OK |
| `docker compose build api` com BuildKit clássico | OK |

Build de produção com variáveis de homologação (rodada anterior, ainda válida como referência):

```bash
cd apps/web
NEXT_PUBLIC_API_URL=/api \
NEXT_PUBLIC_APP_ENV=staging \
NEXT_PUBLIC_SHOW_DEMO_USERS=false \
npm run build
```

## Cobertura da regressão

O `scripts/regression-test.sh` valida, entre outros:

1. autenticação por e-mail institucional (`AUTH_MODE=email`);
2. rejeição de cadastro/login inválidos e conta não verificada;
3. seed habilitado/desabilitado;
4. visibilidade de assets por perfil e endpoint resumido para chamados;
5. paginação, filtros e resumo agregado de chamados;
6. campos dinâmicos do catálogo (validação, persistência, snapshot);
7. CRUD administrativo de usuários, equipamentos, catálogo e perfis;
8. proteção do último administrador e dependências de permissões;
9. auditoria administrativa;
10. inventário modular (cadastros, equipamentos, movimentações, lote, exportação `.xlsx` filtrada, baixa com motivo e auditoria);
11. integridade dos termos (hierarquia SGI → ADCETEI, reserva, atomicidade, datas, lotação e guards de exclusão);
12. datas serializadas com `Z` ou offset explícito;
13. migração não destrutiva de schema legado.

Lista completa e numerada permanece alinhada ao script — consulte `scripts/regression-test.sh` para o detalhe de cada assert.

## Rotas do frontend

Verificação manual recomendada após mudanças de UI (HTTP `200` com `./iniciar-local.sh` ativo):

- `/login`, `/dashboard`
- `/chamados`, `/chamados/novo`
- `/inventario`, `/inventario/lote`, `/inventario/novo`, `/inventario/termos`
- `/administracao/usuarios`, `/administracao/base-cadastros`, `/administracao/catalogo`, `/administracao/perfis`, `/administracao/auditoria`

## Docker e VM
Contextos protegidos por `apps/web/.dockerignore` e `apps/api/.dockerignore`.

O Compose publica somente o gateway; API e PostgreSQL ficam na rede interna. Senhas e `SECRET_KEY` vêm do `.env`. O container da API roda `alembic upgrade head` antes do Uvicorn; se a migration falhar, a API não inicia.

Para banco existente:

1. faça backup;
2. pare a API;
3. rode `python -m app.schema_adoption`;
4. execute `alembic stamp 20260717_0001`;
5. execute `alembic upgrade head`;
6. confirme com `alembic current`;
7. suba a API.

Se o executável Docker não estiver disponível no ambiente de desenvolvimento, valide estrutura com `docker compose config` na máquina de implantação.

## Limitações conhecidas

- Sem refresh token JWT;
- Sem teste E2E automatizado em navegador;
- AD/LDAP fora do fluxo atual;
- anexos reais fora do MVP;
- importação de inventário por planilha ainda não implementada.

Antes de produção: HTTPS, SMTP, backup externo, `SEED_DEMO_DATA=false`, rotação de chaves.
