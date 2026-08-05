# Tarefas - Sprint 10

## 1. Atualizar documentacao oficial

Objetivo: consolidar discovery, master prompt, requisitos, arquitetura, criterios de aceite e divisao de tarefas.

Conclusao: documentos aprovados antes de qualquer codigo.

## 2. Modelagem minima

Objetivo: aplicar somente campos e enums aprovados.

Escopo provavel:

- `mustChangePassword`;
- `passwordChangedAt`;
- `blockedAt`;
- avaliar `blockedByUserId`;
- eventos de auditoria de usuario;
- avaliar inclusao do enum `GESTOR`, sem regras ficticias.

Conclusao: migration minima, Prisma generate e testes de schema.

## 3. Backend de usuarios

Objetivo: criar modulo administrativo `/admin/users`.

Escopo:

- listagem;
- detalhe;
- criacao;
- edicao;
- vinculos institucionais;
- ativar;
- bloquear;
- desbloquear;
- gerar nova senha temporaria.

Conclusao: endpoints protegidos por `SUPER_ADMIN`, sem `DELETE`, e criacao sem senha manual informada.

## 4. Seguranca

Objetivo: implementar protecoes obrigatorias no backend.

Escopo:

- impedir autoacoes criticas;
- proteger ultimo `SUPER_ADMIN` ativo;
- recusar usuario bloqueado no guard;
- invalidar JWT anterior por `passwordChangedAt`;
- preservar `mustChangePassword` no desbloqueio;
- impedir senha/hash em respostas.

Conclusao: testes cobrindo todos os bloqueios.

## 5. Auditoria

Objetivo: auditar toda acao administrativa de usuarios.

Escopo:

- `USER_CREATED`;
- `USER_UPDATED`;
- `USER_BLOCKED`;
- `USER_UNBLOCKED`;
- `USER_PASSWORD_RESET`;
- `USER_FIRST_ACCESS_PASSWORD_CHANGED`;
- `USER_PASSWORD_CHANGED`;
- `USER_ROLE_CHANGED`;
- `USER_INSTITUTIONS_CHANGED`.

Conclusao: eventos semanticamente separados, metadata segura, sem senha/hash/token/cookie, e sem evento duplicado de status para bloqueio/desbloqueio.

## 6. Frontend Administrativo de Usuarios

Objetivo: criar tela administrativa de Usuarios.

Escopo:

- menu restrito;
- listagem responsiva;
- busca;
- filtros;
- badges;
- tags de instituicoes;
- permissoes efetivas;
- dialogos React para acoes sensiveis;
- novo usuario, edicao, instituicoes, bloqueio, desbloqueio e reset de senha temporaria.

Conclusao: SUPER_ADMIN usa o modulo; SECRETARIA e GESTOR nao veem o menu; nenhum uso de `DELETE`, senha manual, `window.confirm`, `window.prompt` ou `alert` no modulo.

## 6.1. Homologacao real do Frontend Administrativo de Usuarios

Objetivo: substituir a validacao mockada por validacao completa com API real.

Escopo:

- login por perfil;
- listagem real;
- criacao real;
- edicao real;
- instituicoes zero, uma e varias;
- bloqueio/desbloqueio;
- reset de senha temporaria;
- primeiro acesso;
- responsividade;
- limpeza de massa temporaria.

Conclusao: API e tela apresentam dados consistentes, screenshots ficam fora do repositorio e residuos finais ficam zerados.

## 7. Minha Conta e Primeiro Acesso

Objetivo: criar modulo separado para dados do proprio usuario.

Escopo:

- ver dados da conta;
- alterar nome;
- alterar propria senha;
- preparar estrutura de foto.
- tela exclusiva de primeiro acesso;
- redirecionamento por `mustChangePassword`;
- tratamento de sessao invalida.

Conclusao: Minha Conta nao altera role, instituicoes, status ou permissoes; primeiro acesso nao exibe menu operacional; troca de senha invalida a sessao e exige novo login.

## 8. Dialogos

Objetivo: implementar fluxos sensiveis sem browser dialogs.

Escopo:

- novo usuario;
- editar usuario;
- selecionar instituicoes;
- bloquear;
- desbloquear;
- gerar senha temporaria;
- exibir senha temporaria uma unica vez.

Conclusao: nenhum uso de `window.confirm`, `window.prompt` ou `alert` no modulo.

## 9. Testes

Objetivo: validar backend, seguranca e frontend.

Escopo:

- UsersService;
- controller admin;
- AuthGuard;
- auditoria;
- Minha Conta;
- scripts/checks de UI se o padrao do repo permitir.

Conclusao: typecheck e testes passam.

## 10. QA

Objetivo: validar a Sprint em fluxo real.

Escopo:

- criar usuario;
- gerar senha temporaria;
- primeiro acesso;
- troca obrigatoria;
- bloqueio;
- desbloqueio;
- autoacoes bloqueadas;
- ultimo SUPER_ADMIN protegido;
- uma/varias/zero instituicoes;
- filtros;
- responsividade;
- screenshots.

Conclusao: build, start, `/health`, `git diff --check`, `git status` e relatorio final. Nao fazer commit nem push.
