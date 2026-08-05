# Arquitetura - Sprint 10

## Separacao de modulos

Administracao de Usuarios e Minha Conta devem ser modulos separados.

Administracao de Usuarios:

- escopo: `SUPER_ADMIN`;
- rota backend sugerida: `/admin/users`;
- finalidade: administrar usuarios, roles, status, instituicoes e senha temporaria.

Minha Conta:

- escopo: qualquer usuario autenticado;
- rota backend sugerida: `/account` ou `/auth/account`;
- finalidade: alterar nome, propria senha e preparar estrutura de foto.

## Backend

Criar controller administrativo de usuarios, preferencialmente fora do `AuthController`, para evitar concentrar regras administrativas em Auth.

Endpoints sugeridos:

- `GET /admin/users`
- `GET /admin/users/:id`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `PATCH /admin/users/:id/institutions`
- `PATCH /admin/users/:id/block`
- `PATCH /admin/users/:id/unblock`
- `POST /admin/users/:id/reset-password`

Nao criar:

- `DELETE /admin/users/:id`

`POST /admin/users` nao deve aceitar senha manual no DTO. O backend deve gerar a senha forte, salvar somente hash, ativar `mustChangePassword`, atualizar `passwordChangedAt` e retornar a senha temporaria uma unica vez.

`PATCH /admin/users/:id/unblock` nao deve alterar `mustChangePassword`. Se o usuario estava com primeiro acesso pendente ou senha temporaria pendente, esse estado permanece ate a troca da propria senha.

Endpoints de Minha Conta sugeridos:

- `GET /account`
- `PATCH /account`
- `PATCH /account/password`

## Modelagem minima

Campos realmente recomendados:

- `mustChangePassword Boolean @default(false)`
- `passwordChangedAt DateTime?`
- `blockedAt DateTime?`
- `blockedByUserId String?`, somente se aprovado para rastreio direto alem da auditoria.

Campos a nao adicionar automaticamente:

- `temporaryPasswordIssuedAt`, se a auditoria for suficiente.
- tabela de sessao, salvo decisao futura.
- estado `ARCHIVED`, apenas preparar conceito.

## Roles

Roles modeladas:

- `SUPER_ADMIN`
- `SECRETARIA`
- `GESTOR`

Nao criar regras ficticias de `GESTOR` nesta sprint. O enum existe para preparar a modelagem, mas o backend nao permite atribuir `GESTOR` no painel administrativo desta Sprint e a UI nao oferece essa opcao.

DTOs e frontend devem tratar roles como lista de opcoes vinda de fonte central, nao como bifurcacao hardcoded entre dois perfis.

## Sessao e JWT

O Atretu usa JWT stateless em cookie HttpOnly.

Para invalidacao economica sem tabela de sessao:

- usar `passwordChangedAt`;
- garantir que o JWT contenha `iat`;
- no `AuthGuard`, recusar token emitido antes de `passwordChangedAt`;
- no `AuthGuard`, recusar usuario com status bloqueado/inativo.

Assim:

- reset de senha derruba token anterior;
- troca de senha derruba token anterior;
- bloqueio derruba acesso na proxima requisicao.
- desbloqueio nao limpa obrigatoriedade de troca de senha.

O token tambem pode carregar o carimbo de `passwordChangedAt` em milissegundos para invalidacao precisa de JWTs emitidos no mesmo segundo de uma troca de credencial. O fallback por `iat` continua servindo para tokens antigos.

## Ultimo acesso

`lastLoginAt` ja existe no `User`.

Ultimo IP e user-agent simplificado nao existem diretamente no `User`. Eles podem ser consultados a partir do ultimo evento `LOGIN_SUCCESS` em `SecurityAuditLog`, se isso for simples e performatico.

Se nao for simples, a Sprint deve documentar a ausencia e nao inventar persistencia nova sem aprovacao.

## Auditoria

`AdministrativeAuditLog` e `SecurityAuditLog` possuem responsabilidades separadas.

`AdministrativeAuditLog` registra mudancas administrativas ou de conta:

- `USER_CREATED`
- `USER_UPDATED`
- `USER_BLOCKED`
- `USER_UNBLOCKED`
- `USER_PASSWORD_RESET`
- `USER_FIRST_ACCESS_PASSWORD_CHANGED`
- `USER_PASSWORD_CHANGED`
- `USER_ROLE_CHANGED`
- `USER_INSTITUTIONS_CHANGED`
- `USER_STATUS_CHANGED`

`USER_PASSWORD_RESET` deve ser usado somente para reset administrativo feito por `SUPER_ADMIN`. Troca obrigatoria de primeiro acesso usa `USER_FIRST_ACCESS_PASSWORD_CHANGED`. Troca voluntaria de senha usa `USER_PASSWORD_CHANGED`.

`USER_STATUS_CHANGED` permanece disponivel para mudanca generica de status, mas bloqueio e desbloqueio devem preferir os eventos especificos `USER_BLOCKED` e `USER_UNBLOCKED`, com `statusBefore` e `statusAfter` na metadata, para evitar duplicidade.

Usar:

- domain: `users`;
- recordId: usuario afetado;
- userId: executor;
- metadata segura e padronizada com `origin`, `targetUserId`, `changedFields`, `before`, `after`, `roleBefore`, `roleAfter`, `statusBefore`, `statusAfter`, `blockedAtBefore`, `blockedAtAfter`, `institutionIdsBefore`, `institutionIdsAfter`, `mustChangePasswordBefore` e `mustChangePasswordAfter`, conforme a acao.

Para reset administrativo, a metadata pode indicar `credentialUpdated=true`, `mustChangePasswordBefore` e `mustChangePasswordAfter`, mas nao deve registrar o valor detalhado de `passwordChangedAt` se isso nao for necessario para suporte.

`SecurityAuditLog` registra eventos de seguranca/autenticacao:

- login bem-sucedido;
- login falho;
- logout;
- token invalido ou tentativa proibida, quando ja suportado pelo mecanismo existente;
- usuario bloqueado/inativo quando a autenticacao negar acesso, se o fluxo ja auditar essa negativa.

Nao duplicar o mesmo fato nos dois logs sem motivo claro.

IP e User-Agent:

- `request.ip` vem do Express/Nest;
- proxy confiavel depende de `trustedProxyHops` configurado em runtime;
- sem proxy confiavel, nao confiar cegamente em `X-Forwarded-For`;
- `User-Agent` deve ser limitado e armazenado como string simplificada;
- nao armazenar headers completos, cookies, Authorization ou Set-Cookie.

Nunca registrar:

- senha;
- senha temporaria;
- hash;
- token;
- cookie.

Instituicoes devem ser auditadas por lista ordenada de IDs para evitar falso positivo causado apenas por mudanca de ordem.

Acoes administrativas criticas devem gravar alteracao e auditoria na mesma transacao quando tecnicamente possivel.

## Frontend

Adicionar area `users` ao Admin apenas para `SUPER_ADMIN`.

Criar painel com:

- header compacto;
- cards de resumo;
- toolbar de busca/filtros;
- tabela responsiva em telas maiores;
- cards compactos em mobile;
- tags de instituicao;
- badges de role, status, primeiro acesso e permissoes efetivas;
- dialogos React para acoes sensiveis;
- modal de senha temporaria exibida uma vez.

Nao usar `window.confirm`, `window.prompt` ou `alert`.
