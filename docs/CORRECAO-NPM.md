# Instalação npm

O projeto distribui `package-lock.json` fixado para o registry público. Instalações locais e builds Docker devem usar o mesmo conjunto de dependências.

O script `iniciar-local.sh` verifica a instalação e, quando necessário, executa:

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
```

## Recuperação após instalação interrompida

```bash
cd apps/web
rm -rf node_modules
npm cache verify
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
cd ../..
./iniciar-local.sh
```
