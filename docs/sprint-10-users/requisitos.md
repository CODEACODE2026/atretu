# Requisitos - Sprint 10

## Administracao de Usuarios

- Criar modulo administrativo de usuarios acessivel somente por `SUPER_ADMIN`.
- `SECRETARIA` nao deve ver o menu e deve receber `403` se tentar acessar endpoints diretamente.
- Nao permitir exclusao fisica de usuarios.
- Nao criar endpoint de `DELETE`.
- Permitir criar usuario, editar dados administrativos, ativar, bloquear, desbloquear e gerar nova senha temporaria.
- Criacao de usuario nunca permite informar senha manualmente.
- Exibir permissoes efetivas de forma clara.

## Listagem

Exibir:

- nome;
- e-mail;
- perfil;
- status;
- instituicoes vinculadas;
- ultimo login;
- ultimo IP, se disponivel;
- navegador/user-agent simplificado, se disponivel;
- criado em.

## Filtros

- Perfil.
- Status.
- Instituicao.
- Nunca logou.
- Primeiro acesso pendente.
- Usuarios bloqueados.
- Usuarios sem instituicao.
- Pesquisa por nome/e-mail.

## Perfis

- Suportar os perfis atuais `SUPER_ADMIN` e `SECRETARIA`.
- Preparar arquitetura para `GESTOR`.
- Nao implementar regras ficticias para `GESTOR`.
- Evitar validacoes e componentes presos a apenas dois perfis.

## Instituicoes

- Permitir selecionar uma ou varias instituicoes.
- Usar checkbox, pesquisa e tags.
- Nunca permitir edicao manual de IDs.
- Validar IDs no backend.
- Alteracao deve ser transacional.

## Minha Conta

- Modulo independente da Administracao de Usuarios.
- Qualquer usuario autenticado pode alterar apenas:
  - nome;
  - propria senha;
  - foto, com estrutura preparada.
- Nunca permitir em Minha Conta:
  - alterar role;
  - alterar instituicoes;
  - alterar status;
  - alterar permissoes.

## Senha temporaria

- Criacao de usuario deve gerar senha temporaria forte automaticamente no backend.
- Acao "Gerar nova senha temporaria" deve estar disponivel para `SUPER_ADMIN`.
- Gerar nova senha temporaria deve invalidar a anterior.
- Salvar apenas hash.
- Ativar `mustChangePassword`.
- Atualizar `passwordChangedAt`.
- Registrar auditoria.
- Exibir a senha apenas uma vez.
- Nunca registrar senha em log.
- Nunca registrar senha em auditoria.
- Nunca retornar senha novamente.

## Bloqueio e ativacao

- Bloqueio impede novo login.
- Bloqueio deve derrubar acesso com token antigo na proxima requisicao.
- Desbloqueio reativa acesso, preservando regras de senha.
- Desbloqueio nunca remove automaticamente `mustChangePassword`.
- `mustChangePassword` so pode ser removido apos o proprio usuario trocar a senha.
- Ativacao deve ser distinta de desbloqueio apenas se a modelagem final exigir; na Sprint 10, evitar criar estados redundantes.

## Protecoes

Nunca permitir:

- bloquear a si proprio;
- remover a propria role `SUPER_ADMIN`;
- remover as proprias instituicoes;
- redefinir a propria senha pelo painel administrativo;
- alterar o proprio status;
- desativar ou bloquear a propria conta;
- autoelevacao de privilegio;
- remover o ultimo `SUPER_ADMIN` ativo.

## Auditoria

Registrar:

- quem executou;
- usuario afetado;
- tipo de evento;
- antes/depois quando aplicavel;
- metadata sem senha, senha temporaria, hash, token ou cookie.

Eventos finais de senha:

- `USER_PASSWORD_RESET`: somente reset administrativo com nova senha temporaria;
- `USER_FIRST_ACCESS_PASSWORD_CHANGED`: troca obrigatoria concluida pelo proprio usuario;
- `USER_PASSWORD_CHANGED`: troca voluntaria feita pelo proprio usuario.

Bloqueio e desbloqueio devem usar `USER_BLOCKED` e `USER_UNBLOCKED`, incluindo `statusBefore` e `statusAfter` na metadata, sem gerar evento duplicado de status para a mesma acao.

`AdministrativeAuditLog` registra mudancas administrativas, Minha Conta e primeiro acesso.
`SecurityAuditLog` registra login, falha de login, logout e eventos de seguranca/autenticacao ja suportados.
