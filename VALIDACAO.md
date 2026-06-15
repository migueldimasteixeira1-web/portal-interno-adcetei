# Validação técnica

Data da rodada: 15 de junho de 2026.

## Comandos executados

```bash
apps/api/.venv/bin/python -m compileall apps/api/app
bash -n iniciar-local.sh resetar-dados.sh scripts/*.sh
./scripts/regression-test.sh

cd apps/web
npm run typecheck
NEXT_PUBLIC_API_URL=/api \
NEXT_PUBLIC_APP_ENV=staging \
NEXT_PUBLIC_SHOW_DEMO_USERS=false \
npm run build
cd ../..

./scripts/smoke-test.sh
```

Também foram executadas verificações isoladas da configuração PostgreSQL, dos segredos de implantação, da estrutura do Compose e do comando de criação do administrador inicial.

Também foram consultadas as rotas:

- `/login`;
- `/dashboard`;
- `/chamados`;
- `/chamados/novo`;
- `/inventario`;
- `/administracao/usuarios`;
- `/administracao/catalogo`;
- `/administracao/perfis`;
- `/administracao/auditoria`.

Todas responderam com HTTP `200` no ambiente local.

## Resultados

- compilação Python: aprovada;
- sintaxe dos scripts: aprovada;
- regressão da API: aprovada;
- TypeScript: aprovado;
- build Next.js: aprovado;
- configuração Compose: estrutura e variáveis aprovadas;
- build de produção do frontend com `/api`, homologação e atalhos demo ocultos: aprovado;
- sintaxe e fluxo do `iniciar-local.sh`: aprovados;
- smoke test isolado: aprovado sem alterar o banco local;
- migração de banco existente: aprovada sem reset;
- criação explícita do primeiro administrador: aprovada;
- senhas PostgreSQL com caracteres especiais: aprovadas;
- rejeição de chave JWT curta fora do ambiente local: aprovada;
- todas as rotas do frontend de produção: HTTP `200`;
- exibição de `2026-06-15T12:00:00Z` em São Paulo: `15/06/2026, 09:00`.

O ambiente desta revisão não possui o executável Docker. Por isso, o Compose final foi validado estruturalmente, mas as imagens finais devem ser construídas pelo `scripts/iniciar-vm.sh` na VM. As imagens da versão recebida já haviam sido construídas com sucesso antes das alterações finais de implantação.

## Cobertura da regressão

O `scripts/regression-test.sh` usa bancos temporários e valida:

1. login por usuário e por e-mail em `AUTH_MODE=email`;
2. rejeição de cadastro com `usuario@cabofrio.rj.gov.br`;
3. bloqueio de login para conta com e-mail não verificado;
4. usuário inativo bloqueado;
5. seed habilitado e desabilitado explicitamente;
6. solicitante sem acesso a `/api/assets`;
7. endpoint resumido sem IP, serial ou sistema operacional;
8. rejeição de equipamento pertencente a outro usuário;
9. paginação com páginas distintas;
10. resumo agregado maior que a página carregada;
11. filtros aplicados aos totais;
12. criação com campos dinâmicos;
13. rejeição de campo obrigatório ausente;
14. rejeição de campo desconhecido;
15. rejeição de e-mail e data inválidos;
16. normalização de limite de tamanho malformado;
17. persistência estruturada das respostas;
18. preservação do serviço e schema usados na abertura;
19. validação do padrão institucional de e-mail;
20. título automático e prioridade inicial;
21. ocultação de notas internas;
22. eventos administrativos públicos;
23. permissões do técnico;
24. datas com `Z` ou offset explícito.
25. criação, edição e bloqueio de usuário local;
26. proteção do último administrador ativo;
27. cadastro e edição de equipamento;
28. criação e arquivamento de serviço;
29. configuração dinâmica de permissões;
30. dependências automáticas entre permissões;
31. reconfiguração de permissões sem vínculo com diretório;
32. auditoria administrativa;
33. rejeição de valores nulos em campos obrigatórios;
34. negação de operações administrativas para perfis sem permissão.

## Migração testada

Uma cópia do banco SQLite anterior foi iniciada com:

```env
SEED_DEMO_DATA=false
```

A aplicação adicionou `tickets.form_data`, `tickets.form_schema_snapshot` e `tickets.service_id` sem exigir reset. O teste automatizado parte de uma tabela legada e confirma as três colunas após a migração.

## Docker e VM

Os contextos continuam protegidos por:

- `apps/web/.dockerignore`;
- `apps/api/.dockerignore`.

O Compose final:

- publica somente o gateway Nginx;
- mantém API e PostgreSQL na rede interna;
- usa `/api` no navegador, sem dependência de `localhost`;
- exige senha PostgreSQL e chave JWT externas ao código;
- desliga seed e atalhos demonstrativos por padrão;
- inclui health check e script de inicialização para VM.

## Limitações e riscos restantes

- AD/LDAP não faz parte do fluxo operacional atual; a validação cobre cadastro por e-mail institucional e autenticação local.
- A alteração de schema usa compatibilidade automática, não versionamento formal. Adotar Alembic antes de novas mudanças de banco.
- O JWT não possui refresh token; sessão expirada exige novo login.
- Configurar HTTPS, proxy reverso, backup, logs, monitoramento e política de rotação de chave antes da implantação.
- Definir `SEED_DEMO_DATA=false` e remover contas demonstrativas no ambiente real.
- Configurar SMTP e `PUBLIC_APP_URL` corretos antes da homologação com usuários reais.
- O teste E2E automatizado em navegador ainda não faz parte do projeto.
