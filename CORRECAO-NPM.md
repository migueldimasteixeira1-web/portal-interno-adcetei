# Instalação npm desta versão

A v2 distribui `package-lock.json` gerado com o registry público. As versões estão fixadas para que instalações locais e builds Docker usem o mesmo conjunto de dependências.

O script `iniciar-local.sh` verifica a instalação atual e, quando necessário, executa:

```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
```

Caso uma instalação seja interrompida, apague a pasta parcial:

```bash
cd apps/web
rm -rf node_modules
npm cache verify
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org/
```

Depois volte para a raiz do projeto:

```bash
cd ../..
./iniciar-local.sh
```
