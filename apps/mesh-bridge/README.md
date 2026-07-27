# Mesh Bridge

Serviço interno usado pelo Portal ADCETEI para conversar com o MeshCentral sem expor credenciais ao frontend.

O serviço não deve ser publicado na internet. Apenas a API FastAPI do Portal deve conseguir acessá-lo.

## Modos

- `MESH_BRIDGE_MOCK=true`: retorna computadores simulados para desenvolvimento.
- `MESH_BRIDGE_MOCK=false`: usa `meshctrl` instalado na imagem Docker para consultar o MeshCentral.

## Rotas HTTP

| Método | Rota | Token | Descrição |
|--------|------|-------|-----------|
| GET | `/health` | não | Healthcheck |
| GET | `/devices` | sim | Lista dispositivos |
| GET | `/devices/:nodeId` | sim | Detalhe de dispositivo |
| POST | `/session-url` | sim | URL do visualizador |
| POST | `/users/sync` | sim | Stub reservado |

Parâmetros de `/devices`:

- `q` ou `search`: filtro textual
- `online=true|false`: filtro de status
- `status=online|offline`: alias do filtro acima
- `page`, `page_size`: paginação

## Listagem via meshctrl

O bridge executa:

```bash
node meshctrl.js listdevices --url "$MESHCENTRAL_URL" --loginuser ... --loginpass ... --json
```

A saída pode ser grande (>1 MB). O processo grava stdout em arquivo temporário para evitar truncamento por backpressure de pipe.

O parser:

1. tenta `JSON.parse` no retorno completo;
2. se falhar, extrai blocos `"type": "node"` com balanceamento de chaves;
3. deduplica por `node_id`;
4. marca online quando `conn > 0` ou `pwr > 0`.

## URL de sessão

Configure `MESH_SESSION_URL_TEMPLATE` conforme a política da VM do MeshCentral.

Exemplo atual (sem autenticação automática):

```env
MESH_SESSION_URL_TEMPLATE={publicUrl}/?node={nodeId}&viewmode=10
```

Próxima etapa prevista (login token):

```env
MESH_SESSION_URL_TEMPLATE={publicUrl}/?login={loginToken}&node={nodeId}&viewmode=11&hide=15
```

Placeholders suportados hoje: `{publicUrl}`, `{nodeId}`.

## Variáveis

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP do bridge (padrão 8080) |
| `MESH_BRIDGE_SHARED_SECRET` | Token exigido nas rotas protegidas |
| `MESH_BRIDGE_MOCK` | Modo simulado |
| `MESHCENTRAL_URL` | URL WSS/HTTPS do servidor MeshCentral |
| `MESHCENTRAL_PUBLIC_URL` | URL pública usada no navegador |
| `MESHCENTRAL_ADMIN_USER` | Usuário de integração |
| `MESHCENTRAL_ADMIN_PASS` | Senha de integração |
| `MESHCENTRAL_DOMAIN` | Domínio MeshCentral, se multi-tenant |
| `MESH_SESSION_URL_TEMPLATE` | Template da URL do visualizador |
| `MESH_SESSION_TTL_SECONDS` | TTL informado na resposta de sessão |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `0` apenas em homologação com cert self-signed |

Tokens, senhas, certificados e bancos reais do MeshCentral nunca devem entrar no repositório.

## Desenvolvimento local

```bash
cd apps/mesh-bridge
cp .env.example .env
npm start
```

Validação de sintaxe:

```bash
node --check src/server.js
```
