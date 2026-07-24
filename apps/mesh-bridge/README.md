# Mesh Bridge

Serviço interno usado pelo Portal ADCETEI para conversar com o MeshCentral sem expor credenciais ao frontend.

O serviço não deve ser publicado na internet. Apenas a API FastAPI do Portal deve conseguir acessá-lo.

## Modos

- `MESH_BRIDGE_MOCK=true`: retorna computadores simulados para desenvolvimento.
- `MESH_BRIDGE_MOCK=false`: usa `meshctrl` instalado na imagem para consultar o MeshCentral.

## URL de sessão

Para produção, configure `MESH_SESSION_URL_TEMPLATE` com o formato definido na VM do MeshCentral depois de habilitar a estratégia de token/link temporário.

Tokens, senhas, certificados e bancos reais do MeshCentral nunca devem entrar no repositório.
