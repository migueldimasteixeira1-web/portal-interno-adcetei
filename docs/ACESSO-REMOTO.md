# Acesso Remoto — operação e implantação

Runbook do módulo de acesso remoto com MeshCentral. Visão arquitetural e organização de código: [ARQUITETURA.md](./ARQUITETURA.md#acesso-remoto).

## Antes de habilitar em produção

1. Criar usuário de integração no MeshCentral (conta dedicada, não a conta pessoal de admin).
2. Desabilitar criação pública de contas no MeshCentral (`NewAccounts=false`).
3. Usar domínio confiável para o MeshCentral, preferencialmente em subdomínio próprio.
4. Confirmar `allowLoginToken: true` e `CookieEncoding: "hex"` no MeshCentral.
5. Definir `MESH_BRIDGE_SHARED_SECRET` forte.
6. Configurar `REMOTE_ACCESS_ENABLED=true` somente depois de validar o bridge.
7. Não reutilizar ZIPs de produção como arquivos de desenvolvimento.

## Variáveis principais

```env
REMOTE_ACCESS_ENABLED=true
MESH_BRIDGE_URL=http://mesh-bridge:8080
MESH_BRIDGE_SHARED_SECRET=chave-grande
MESH_BRIDGE_MOCK=false
MESH_DEVICES_CACHE_TTL_MS=30000
MESHCENTRAL_URL=wss://192.168.10.222
MESHCENTRAL_PUBLIC_URL=https://192.168.10.222
MESHCENTRAL_ADMIN_USER=portal-integracao
MESHCENTRAL_ADMIN_PASS=senha-forte
MESHCENTRAL_DOMAIN=
MESHCENTRAL_LOGIN_TOKEN_KEY=hex-da-vm-meshcentral
MESHCENTRAL_LOGIN_USER_ID=
MESH_SESSION_URL_TEMPLATE={publicUrl}/?login={loginToken}&node={nodeId}&gotonode={nodeId}&viewmode=11&hide=31
MESH_SESSION_TTL_SECONDS=3600
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Observações:

- `MESHCENTRAL_URL`: URL usada pelo `meshctrl` dentro do container (pode ser `wss://`).
- `MESHCENTRAL_PUBLIC_URL`: URL aberta no navegador do técnico (HTTPS).
- `MESHCENTRAL_LOGIN_TOKEN_KEY`: chave obtida na VM do MeshCentral com `node node_modules/meshcentral --loginTokenKey`.
- `MESH_DEVICES_CACHE_TTL_MS`: tempo de cache da listagem em ms (padrão 30s). Valores menores deixam a lista mais atual; valores maiores reduzem chamadas lentas ao MeshCentral.
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: apenas para homologação com certificado self-signed.

## Configuração no MeshCentral

No `config.json` da VM do MeshCentral:

```json
{
  "settings": {
    "allowLoginToken": true,
    "CookieEncoding": "hex"
  }
}
```

Obter a chave de integração (na VM do MeshCentral):

```bash
node node_modules/meshcentral --loginTokenKey
```

Copie o valor hex para `MESHCENTRAL_LOGIN_TOKEN_KEY` no `.env` do Portal. **Não commite essa chave no Git.**

O certificado HTTPS do MeshCentral deve ser confiável no navegador do técnico. O usuário Mesh usado no token deriva de `MESHCENTRAL_ADMIN_USER` ou de `MESHCENTRAL_LOGIN_USER_ID` quando informado explicitamente.

## Validação do mesh-bridge

Sintaxe:

```bash
docker compose run --rm --no-deps mesh-bridge node --check /app/src/server.js
```

Subir serviços:

```bash
docker compose up -d --build mesh-bridge api
```

Health (público, sem token):

```bash
docker compose exec -T api python - <<'PY'
import os, urllib.request
print(urllib.request.urlopen(os.environ["MESH_BRIDGE_URL"] + "/health", timeout=10).read().decode())
PY
```

Listagem (exige token):

```bash
docker compose exec -T api python - <<'PY'
import os, urllib.request
url = os.environ["MESH_BRIDGE_URL"] + "/devices?page_size=10"
req = urllib.request.Request(url, headers={"X-Bridge-Token": os.environ["MESH_BRIDGE_SHARED_SECRET"]})
print(urllib.request.urlopen(req, timeout=60).read().decode())
PY
```

Somente online:

```bash
docker compose exec -T api python - <<'PY'
import os, urllib.request
url = os.environ["MESH_BRIDGE_URL"] + "/devices?online=true&page_size=10"
req = urllib.request.Request(url, headers={"X-Bridge-Token": os.environ["MESH_BRIDGE_SHARED_SECRET"]})
print(urllib.request.urlopen(req, timeout=60).read().decode())
PY
```

Critérios esperados:

- `docker compose ps` mostra `mesh-bridge` healthy.
- `/devices` retorna dispositivos reais.
- `summary.online` é maior que zero quando o MeshCentral nativo tem máquinas online.
- `/devices?online=true` retorna apenas máquinas online.

## Validação pelo Portal

1. Entrar como técnico/admin.
2. Abrir **Acesso Remoto**.
3. Verificar computadores online/offline.
4. Clicar **Acessar**, informar motivo e **Conectar**.
5. Na nova aba do MeshCentral, clicar **Conectar** para iniciar o desktop.
6. Encerrar sessão no Portal.
7. Conferir auditoria administrativa.

## Desenvolvimento local

Para testar sem VM real:

```env
REMOTE_ACCESS_ENABLED=true
MESH_BRIDGE_URL=http://localhost:8080
MESH_BRIDGE_MOCK=true
```

Depois rode o `mesh-bridge` localmente:

```bash
cd apps/mesh-bridge
npm start
```

## Problemas comuns

### Todos os dispositivos aparecem offline

Causa usual: saída truncada do `meshctrl` ao capturar stdout via pipe. A versão atual do bridge grava a saída em arquivo temporário antes de parsear. Se o problema persistir, confirme que a imagem foi reconstruída:

```bash
docker compose up -d --build mesh-bridge
```

### Listagem ou conexão lenta

O bridge mantém cache em memória da listagem MeshCentral (`MESH_DEVICES_CACHE_TTL_MS`, padrão 30s). Isso evita rodar `meshctrl listdevices` a cada clique em **Acessar**. Para forçar atualização imediata:

```bash
curl -H "X-Bridge-Token: $MESH_BRIDGE_SHARED_SECRET" "http://localhost:8080/devices?refresh=1"
```

O fluxo **Conectar** usa `POST /api/remote-access/sessions/connect`, que cria a sessão e gera a URL em uma única chamada.

### Erro de autenticação ou tela preta no visualizador

Confirme no MeshCentral:

1. `allowLoginToken: true` no `config.json`
2. `MESHCENTRAL_LOGIN_TOKEN_KEY` preenchida no `.env` do Portal
3. `MESHCENTRAL_ADMIN_USER` corresponde a uma conta MeshCentral válida
4. Certificado HTTPS do MeshCentral instalado como confiável no navegador do técnico
5. Na aba do MeshCentral, clique em **Conectar** após a URL abrir

Testar geração de URL:

```bash
docker compose exec -T api python - <<'PY'
import os, json, urllib.request
url = os.environ["MESH_BRIDGE_URL"] + "/session-url"
body = json.dumps({"node_id": "node//mock-test"}).encode()
req = urllib.request.Request(
    url,
    data=body,
    headers={
        "Content-Type": "application/json",
        "X-Bridge-Token": os.environ["MESH_BRIDGE_SHARED_SECRET"],
    },
    method="POST",
)
print(urllib.request.urlopen(req, timeout=30).read().decode())
PY
```

A resposta deve conter `embed_url` com `?login=` na query string.

### mesh-bridge unhealthy

Confirme que `/health` é público e responde 200. O healthcheck do container usa essa rota sem token.

### Erro TLS ao chamar MeshCentral

Em homologação com certificado self-signed, configure `NODE_TLS_REJECT_UNAUTHORIZED=0` no serviço `mesh-bridge` do `compose.yaml`.
