# Runbook do Acesso Remoto

## Antes de habilitar em produção

1. Criar usuário de integração no MeshCentral (conta dedicada, não a conta pessoal de admin).
2. Desabilitar criação pública de contas no MeshCentral (`NewAccounts=false`).
3. Usar domínio confiável para o MeshCentral, preferencialmente em subdomínio próprio.
4. Confirmar `AllowFraming=true` no MeshCentral.
5. Definir `MESH_BRIDGE_SHARED_SECRET` forte.
6. Configurar `REMOTE_ACCESS_ENABLED=true` somente depois de validar o bridge.
7. Não reutilizar ZIPs de produção como arquivos de desenvolvimento.

## Variáveis principais

```env
REMOTE_ACCESS_ENABLED=true
MESH_BRIDGE_URL=http://mesh-bridge:8080
MESH_BRIDGE_SHARED_SECRET=chave-grande
MESH_BRIDGE_MOCK=false
MESHCENTRAL_URL=wss://192.168.10.222
MESHCENTRAL_PUBLIC_URL=https://192.168.10.222
MESHCENTRAL_ADMIN_USER=portal-integracao
MESHCENTRAL_ADMIN_PASS=senha-forte
MESHCENTRAL_DOMAIN=
MESH_SESSION_URL_TEMPLATE={publicUrl}/?node={nodeId}&viewmode=10
MESH_SESSION_TTL_SECONDS=3600
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Observações:

- `MESHCENTRAL_URL`: URL usada pelo `meshctrl` dentro do container (pode ser `wss://`).
- `MESHCENTRAL_PUBLIC_URL`: URL aberta no navegador do técnico (HTTPS).
- `NODE_TLS_REJECT_UNAUTHORIZED=0`: apenas para homologação com certificado self-signed.

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
4. Criar sessão com motivo.
5. Abrir visualizador.
6. Encerrar sessão.
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

### Erro de autenticação no iframe

A listagem funciona, mas o visualizador mostra “Não foi possível realizar autenticação”.

Causa: a URL atual abre o MeshCentral sem login token. O técnico está autenticado no Portal, não no MeshCentral.

Próximo passo: habilitar `allowLoginToken` no MeshCentral e implementar geração de token no `mesh-bridge`. Ver `docs/acesso-remoto/architecture.md`.

Workaround temporário: abrir `MESHCENTRAL_PUBLIC_URL` em outra aba, autenticar manualmente e tentar novamente (pode falhar entre IPs/domínios diferentes por causa de cookies).

### mesh-bridge unhealthy

Confirme que `/health` é público e responde 200. O healthcheck do container usa essa rota sem token.

### Erro TLS ao chamar MeshCentral

Em homologação com certificado self-signed, configure `NODE_TLS_REJECT_UNAUTHORIZED=0` no serviço `mesh-bridge` do `compose.yaml`.

## Próxima etapa: login token no MeshCentral

No `config.json` da VM do MeshCentral:

```json
{
  "settings": {
    "allowLoginToken": true,
    "allowFraming": true,
    "sessionSameSite": "none"
  }
}
```

Depois ajustar o template:

```env
MESH_SESSION_URL_TEMPLATE={publicUrl}/?login={loginToken}&node={nodeId}&viewmode=11&hide=15
```

A implementação da geração de `{loginToken}` no bridge será feita na próxima entrega desta branch.
