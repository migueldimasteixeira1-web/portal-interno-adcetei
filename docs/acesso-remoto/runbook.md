# Runbook do Acesso Remoto

## Antes de habilitar em produção

1. Criar usuário de integração no MeshCentral.
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
MESHCENTRAL_URL=https://remoto.exemplo.local
MESHCENTRAL_PUBLIC_URL=https://remoto.exemplo.local
MESHCENTRAL_ADMIN_USER=portal-integracao
MESHCENTRAL_ADMIN_PASS=senha-forte
MESH_SESSION_URL_TEMPLATE={publicUrl}/?node={nodeId}&viewmode=10
```

## Validação rápida

```bash
curl http://localhost:8080/health
```

Pelo Portal:

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
