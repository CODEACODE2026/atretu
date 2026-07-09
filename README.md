# Atretu

Sistema administrativo para a Associacao Terrariquense de Estudantes Tecnicos e Universitarios.

## Status
Sprint 1: base de seguranca, autenticacao e permissoes em andamento.

Este repositorio ainda nao implementa regras de negocio. A Sprint 0 prepara apenas a base tecnica do projeto.

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

## Limites atuais
- Nao ha regras de negocio.
- Nao ha modulos funcionais.
- Nao ha migrations de dominio.
- Nao ha integracao Sicredi.
- Nao ha PDFs.
- Nao ha portal do academico.
- Nao ha deploy.

## Documentacao de planejamento
Os documentos de planejamento estao no AI Office:

```text
/opt/codeacode/ai-office/projects/atretu
```
