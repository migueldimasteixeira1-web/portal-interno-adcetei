# Acesso Remoto com MeshCentral

Esta branch implementa a primeira etapa do módulo **Acesso Remoto**.

## Objetivo

O Portal ADCETEI passa a ser a interface operacional para acesso remoto, sem expor credenciais do MeshCentral no frontend e sem copiar o frontend nativo do MeshCentral.

## Desenho

```text
Técnico -> Portal Web -> API FastAPI -> Mesh Bridge interno -> MeshCentral -> Agente
```

Responsabilidades:

- **Portal Web**: tela, filtros, justificativa e visualizador incorporado.
- **API FastAPI**: autenticação, permissões, auditoria, sessão e vínculo opcional com inventário/chamado.
- **Mesh Bridge**: serviço Node.js interno que chama o MeshCentral via `meshctrl` e gera a URL de visualização.
- **MeshCentral**: motor de acesso remoto.

## Mesh Bridge

Serviço interno em `apps/mesh-bridge`. Não deve ser exposto na internet; apenas a API FastAPI o acessa.

### Rotas

| Rota | Autenticação | Descrição |
|------|--------------|-----------|
| `GET /health` | pública | Healthcheck do container |
| `GET /devices` | `X-Bridge-Token` | Lista dispositivos com paginação e filtros |
| `GET /devices/:nodeId` | `X-Bridge-Token` | Detalhe de um dispositivo |
| `POST /session-url` | `X-Bridge-Token` | Gera URL do visualizador |
| `POST /users/sync` | `X-Bridge-Token` | Stub reservado para provisionamento futuro |

Quando `MESH_BRIDGE_SHARED_SECRET` estiver definido, todas as rotas exceto `/health` exigem o header `X-Bridge-Token`.

### Listagem de dispositivos

O bridge consulta o MeshCentral com:

```bash
meshctrl listdevices --json
```

Pontos importantes da implementação:

1. **Comando em minúsculo**: nesta versão do MeshCentral, o comando correto é `listdevices`, não `ListDevices` nem `listnodes`.
2. **Saída completa**: o retorno JSON pode passar de 1 MB. Capturar stdout via pipe truncava a resposta e fazia todos os dispositivos aparecerem offline. O bridge grava a saída do `meshctrl` em arquivo temporário e só então lê o conteúdo.
3. **Parser robusto**: tenta `JSON.parse` no retorno inteiro; se falhar, extrai blocos `"type": "node"` com balanceamento de chaves, respeitando strings e escapes.
4. **Status online**: um dispositivo é considerado online quando `conn > 0` ou `pwr > 0`.
5. **Deduplicação**: dispositivos repetidos são consolidados por `node_id`, preservando `online=true` se alguma ocorrência estiver online.

### Modo mock

Com `MESH_BRIDGE_MOCK=true`, o bridge retorna dispositivos simulados sem chamar o MeshCentral. Útil para desenvolvimento local.

## Segurança

- O frontend nunca recebe senha administrativa do MeshCentral.
- A API registra solicitação, abertura e encerramento.
- O motivo do acesso é obrigatório.
- A primeira versão libera somente `desktop`.
- Terminal, arquivos, comandos em lote e administração ficam fora do MVP.
- Banco, certificados e chaves reais do MeshCentral não entram no repositório.

## Permissões

Novas permissões:

- `remote_access.view`: consultar computadores remotos.
- `remote_access.connect`: criar e abrir sessões remotas.
- `remote_access.manage`: futura administração da integração.

O administrador recebe todas por padrão. O perfil técnico deve receber `view` e `connect` manualmente quando a ADCETEI decidir quem está autorizado a acessar máquinas remotamente.

## Tabelas criadas

- `remote_device_links`: vínculo opcional entre dispositivo MeshCentral e equipamento do inventário.
- `remote_access_sessions`: histórico de sessões autorizadas, abertas, encerradas ou com falha.

## URL de sessão e autenticação no iframe

O bridge gera um **login token** temporário e monta a URL com `MESH_SESSION_URL_TEMPLATE`:

```text
{publicUrl}/?login={loginToken}&node={nodeId}&viewmode=11&hide=15
```

- `viewmode=11`: área de trabalho remota
- `hide=15`: oculta cabeçalho, abas e rodapé do MeshCentral no iframe
- `{loginToken}`: token AES-GCM gerado com `MESHCENTRAL_LOGIN_TOKEN_KEY`

### Configuração no MeshCentral

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

Obter a chave de integração (na VM do MeshCentral, com o serviço parado ou em manutenção):

```bash
node node_modules/meshcentral --loginTokenKey
```

Copie o valor hex para `MESHCENTRAL_LOGIN_TOKEN_KEY` no `.env` do Portal. **Não commite essa chave no Git.**

O usuário Mesh usado no token deriva de `MESHCENTRAL_ADMIN_USER` (`user//admin` no domínio padrão) ou de `MESHCENTRAL_LOGIN_USER_ID` quando informado explicitamente (`user//admin`, `user/domínio/usuário`).

A auditoria de quem acessou e o motivo ficam no Portal (`remote_access_sessions` + `audit_logs`). O MeshCentral registra a sessão técnica da conta de integração.

## TLS entre bridge e MeshCentral

Em homologação com certificado self-signed, o container do bridge pode usar:

```env
NODE_TLS_REJECT_UNAUTHORIZED=0
```

Isso afeta apenas a comunicação servidor-a-servidor (`mesh-bridge` → MeshCentral). Não substitui certificado confiável para o navegador do técnico.
