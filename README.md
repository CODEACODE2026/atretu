# Atretu

Sistema administrativo para a Associacao Terrariquense de Estudantes Tecnicos e Universitarios.

## Status
Sprint 2: cadastros base administrativos implementados para Instituicoes,
Turnos e Onibus.

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS.
- Backend/API: NestJS + TypeScript.
- Banco previsto: PostgreSQL.
- ORM/migrations previsto: Prisma.
- Jobs/fila previsto: Redis + BullMQ.
- Infra alvo: desenvolvimento local e producao futura em VPS com Nginx.

## Estrutura
```text
apps/
  web/      Frontend administrativo
  api/      API backend
  worker/   Worker de jobs
packages/
  shared/   Tipos e utilitarios compartilhados
```

## Comandos
```bash
npm install
npm run typecheck
npm run build
npm run test
npm run validate
```

## Autenticacao administrativa

A Sprint 1 usa cookie `HttpOnly` para transportar o token administrativo entre
frontend e API. O frontend deve chamar a API com `credentials: include` e nao
armazenar o token em `localStorage`.

Rotas iniciais:

- `POST /auth/bootstrap/super-admin`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /auth/admin-check`
- `GET /auth/operational-check`
- `POST /auth/users` restrita ao Super Admin

## Cadastros base

A Sprint 2 implementa Instituicoes, Turnos e Onibus com ativacao,
inativacao e reativacao. Nao ha `DELETE` administrativo para esses cadastros.
Registros inativos permanecem no banco e as listagens usam ativos como padrao.

Rotas:

- `GET /institutions`
- `POST /institutions`
- `GET /institutions/:id`
- `PATCH /institutions/:id`
- `PATCH /institutions/:id/inactivate`
- `PATCH /institutions/:id/reactivate`
- `GET /shifts`
- `POST /shifts`
- `GET /shifts/:id`
- `PATCH /shifts/:id`
- `PATCH /shifts/:id/inactivate`
- `PATCH /shifts/:id/reactivate`
- `GET /buses`
- `POST /buses`
- `GET /buses/:id`
- `PATCH /buses/:id`
- `PATCH /buses/:id/inactivate`
- `PATCH /buses/:id/reactivate`

Parametros de listagem:

- `page`
- `limit`
- `search`
- `status=active|inactive|all`
- `sort=name|status|createdAt|updatedAt`
- `order=asc|desc`

O bootstrap do primeiro Super Admin exige o header:

```text
x-admin-setup-token: valor_do_ADMIN_SETUP_TOKEN
```

Smoke de autenticacao, com API e banco ja disponiveis:

```bash
npm --prefix apps/api run prisma:migrate
npm --prefix apps/api run start
ADMIN_SETUP_TOKEN=... npm --prefix apps/api run smoke:auth
```

Smoke da Sprint 2, com API e banco ja disponiveis:

```bash
ADMIN_SETUP_TOKEN=... npm --prefix apps/api run smoke:base-records
```

## Limites atuais
- Nao ha pessoas, academicos, matriculas ou vinculos com onibus.
- Nao ha ocupacao real de onibus nem contador manual de vagas.
- Nao ha integracao Sicredi.
- Nao ha PDFs.
- Nao ha documentos/uploads.
- Nao ha portal do academico.
- Nao ha deploy.

## Documentacao de planejamento
Os documentos de planejamento estao no AI Office:

```text
/opt/codeacode/ai-office/projects/atretu
```
