# Master Prompt - Sprint 10 Atretu

Implementar a Sprint 10 do Atretu em tarefas pequenas e controladas, preservando todos os fluxos homologados.

## Diretrizes obrigatorias

- Somente `SUPER_ADMIN` administra usuarios.
- `SECRETARIA` nao acessa o modulo administrativo de usuarios.
- Nao implementar exclusao fisica de usuarios.
- Nao criar endpoint `DELETE /admin/users/:id`.
- Trabalhar apenas com ativar, bloquear e desbloquear.
- Preparar a arquitetura para o perfil `GESTOR`, sem implementar permissoes ficticias.
- Separar completamente Administracao de Usuarios e Minha Conta.
- Minha Conta permite apenas alterar nome, propria senha e estrutura futura de foto.
- Minha Conta nunca altera role, instituicoes, status ou permissoes.
- Autorizacao sempre no backend.
- Frontend apenas apresenta mensagens e estados.
- Reutilizar `UsersService`, `AuthService`, roles, `UserInstitution`, auditoria e mecanismos existentes.
- Nao duplicar regras de instituicao.
- Nao armazenar senha temporaria em texto.
- Nunca retornar senha ou hash em listagem, detalhe, auditoria, log ou resposta posterior.
- A criacao de usuario nunca aceita senha manual; o backend sempre gera uma senha forte automaticamente.
- Retornar senha temporaria apenas uma vez na criacao ou regeneracao.
- Primeiro login com senha temporaria deve exigir troca.
- Gerar nova senha temporaria deve invalidar a anterior, salvar somente hash, ativar `mustChangePassword`, atualizar `passwordChangedAt`, registrar auditoria e exibir a senha uma unica vez.
- Desbloquear usuario nunca remove automaticamente `mustChangePassword`; somente a troca de senha pelo proprio usuario pode limpar a flag.
- Bloqueio deve impedir novo login e derrubar acesso com token antigo na proxima requisicao.
- Troca ou reset de senha deve invalidar JWT anterior se a arquitetura permitir.

## Protecoes obrigatorias

Nunca permitir:

- bloquear a si proprio;
- remover a propria role `SUPER_ADMIN`;
- remover as proprias instituicoes;
- redefinir a propria senha pelo painel administrativo;
- alterar o proprio status;
- desativar ou bloquear a propria conta;
- autoelevacao de privilegio;
- remover o ultimo `SUPER_ADMIN` ativo.

Todas essas protecoes devem existir no backend.

## Auditoria obrigatoria

Registrar eventos administrativos de usuarios sem dados sensiveis:

- `USER_CREATED`
- `USER_UPDATED`
- `USER_BLOCKED`
- `USER_UNBLOCKED`
- `USER_PASSWORD_RESET`
- `USER_FIRST_ACCESS_PASSWORD_CHANGED`
- `USER_PASSWORD_CHANGED`
- `USER_ROLE_CHANGED`
- `USER_INSTITUTIONS_CHANGED`

`USER_PASSWORD_RESET` e exclusivo do reset administrativo feito por `SUPER_ADMIN`.
Troca obrigatoria de primeiro acesso usa `USER_FIRST_ACCESS_PASSWORD_CHANGED`.
Troca voluntaria de senha usa `USER_PASSWORD_CHANGED`.
Bloqueio e desbloqueio usam os eventos especificos `USER_BLOCKED` e `USER_UNBLOCKED`, com `statusBefore` e `statusAfter` na metadata, sem evento duplicado de status.

Metadados podem conter antes/depois de role, status, bloqueio, instituicoes e obrigacao de troca de senha, mas nunca senha, senha temporaria, hash, token ou cookie.

## UI obrigatoria

- Menu "Usuarios" restrito a `SUPER_ADMIN`.
- Tela moderna seguindo o padrao Admin.
- Busca por nome/e-mail.
- Filtros por perfil, status, instituicao, nunca logou, primeiro acesso pendente, usuarios bloqueados e usuarios sem instituicao.
- Badges para perfil, status, primeiro acesso e permissoes efetivas.
- Dialogos React controlados.
- Sem `window.confirm`, `window.prompt` ou `alert`.
- Desktop, notebook, tablet e mobile.
- Sem scroll horizontal.

## Criterio macro de conclusao

A Sprint so termina apos backend, frontend, testes, QA real, screenshots, typecheck, test, build, `git diff --check`, `git status` e `git diff --stat`. Nao fazer commit nem push.
