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
- **Mesh Bridge**: serviço Node.js interno que chama o MeshCentral/meshctrl e gera a URL de visualização.
- **MeshCentral**: motor de acesso remoto.

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

## Observação sobre URL de sessão

A URL final de sessão depende da política ativada no MeshCentral da VM. Por isso, o `mesh-bridge` suporta `MESH_SESSION_URL_TEMPLATE`.

Exemplo de template:

```text
{publicUrl}/?node={nodeId}&viewmode=10
```

Quando a VM tiver login por token/link temporário configurado, esse template deve ser ajustado sem alterar o frontend ou a API.
