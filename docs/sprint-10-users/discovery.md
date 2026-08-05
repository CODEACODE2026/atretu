# Sprint 10 - Gestao de Usuarios, Perfis e Permissoes

## Contexto

O Atretu ja possui autenticacao, JWT, roles, status de usuario, vinculo multi-instituicao por `UserInstitution`, isolamento institucional e auditoria operacional. A Sprint 10 cria o modulo administrativo de usuarios para transformar o sistema em um SaaS administravel, sem alterar fluxos homologados de Dashboard, Financeiro, Cobranca, Relatorios, Sicredi ou regras financeiras.

## Objetivo

Permitir que apenas usuarios com perfil `SUPER_ADMIN` administrem usuarios do sistema, com ativacao, bloqueio, desbloqueio, criacao, edicao, senha temporaria, vinculo institucional, visualizacao de permissoes efetivas e auditoria completa.

## Fora de escopo

- Exclusao fisica de usuarios.
- Implementacao de regras do perfil `GESTOR`.
- Envio de e-mail.
- Alteracoes em Dashboard, Financeiro, Cobranca, Relatorios, Sicredi e regras financeiras.
- Commit e push.

## Decisoes funcionais

- Nao existira `DELETE` de usuario na Sprint 10.
- Usuarios historicos devem permanecer referenciaveis em logs, auditoria, documentos, financeiro e relatorios.
- A operacao destrutiva sera substituida por status administrativo: ativar, bloquear e desbloquear.
- O conceito de arquivamento pode ser preparado conceitualmente, mas nao sera implementado agora.
- Administracao de Usuarios e Minha Conta serao modulos separados.
- Minha Conta permitira que qualquer usuario autenticado altere apenas nome, propria senha e, futuramente, foto.
- Minha Conta nunca altera role, instituicoes, status ou permissoes.
- A criacao de usuario nunca permitira senha manual; o backend sempre gera uma senha forte, exibida uma unica vez.
- Desbloquear usuario nunca remove automaticamente `mustChangePassword`; essa flag so cai quando o proprio usuario troca a senha.

## Estado atual auditado

- `User` possui `id`, `name`, `email`, `passwordHash`, `status`, `createdAt`, `updatedAt`, `lastLoginAt`, roles e instituicoes.
- Roles atuais: `SUPER_ADMIN` e `SECRETARIA`.
- `UserStatus` atual: `ACTIVE` e `INACTIVE`.
- `lastLoginAt` e atualizado no login.
- IP e user-agent sao gravados em `SecurityAuditLog` para eventos de login, mas nao estao persistidos diretamente no usuario.
- Nao existe tela administrativa de usuarios.
- Nao existe fluxo de senha temporaria.
- Nao existe obrigatoriedade de troca de senha no primeiro acesso.
- Nao existe tabela de sessao.
- O JWT atual e stateless, em cookie HttpOnly, com expiracao configurada.
- O login recusa usuario inativo, mas o guard atual precisa ser ajustado para recusar usuario bloqueado em requisicoes com token ja emitido.

## Dados de ultimo acesso

A listagem devera exibir:

- Ultimo login: disponivel por `User.lastLoginAt`.
- Ultimo IP: ainda nao esta salvo diretamente no usuario; pode ser derivado do ultimo `LOGIN_SUCCESS` em `SecurityAuditLog`, se viavel e performatico.
- Navegador/user-agent simplificado: ainda nao esta salvo diretamente no usuario; pode ser derivado do ultimo `LOGIN_SUCCESS` em `SecurityAuditLog`, se viavel e performatico.

Nao inventar campos ou comportamento sem necessidade. Caso derivar da auditoria gere complexidade ou custo excessivo, documentar como parcial e deixar apenas `lastLoginAt` nesta sprint.

## Resultado esperado

Um modulo administrativo seguro, auditado e responsivo, com autorizacao no backend, sem exclusao fisica, sem vazamento de senha e preparado para incluir o perfil `GESTOR` no futuro sem engessar enums, DTOs, validacoes ou tela.
