# Atretu

Sistema administrativo para a Associacao Terrariquense de Estudantes Tecnicos e Universitarios.

## Status
Sprint 7: cadastros base, nucleo academico, vinculos de Onibus por Matricula
Anual, documentos privados, pre-cadastro publico com aprovacao administrativa,
suspensao, reativacao, desligamento e diretoria implementados.

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

## Academicos e matriculas

A Sprint 3 implementa o nucleo academico sem transporte, documentos,
carteirinhas, financeiro, dashboard ou portal do academico.

Rotas:

- `GET /academic-years`
- `POST /academic-years` restrita ao Super Admin
- `PATCH /academic-years/:id` restrita ao Super Admin
- `PATCH /academic-years/:id/set-current` restrita ao Super Admin
- `GET /students`
- `POST /students`
- `GET /students/:id`
- `PATCH /students/:id/person`
- `PATCH /students/:id/guardian`
- `POST /students/:id/enrollments`
- `PATCH /students/:id/enrollments/:enrollmentId`

Regras principais:

- CPF do academico e obrigatorio, valido, normalizado e unico.
- Data de nascimento do academico e obrigatoria e nao pode ser futura.
- Endereco minimo: logradouro, numero, bairro e cidade.
- Responsavel e opcional e limitado a um por academico.
- Ano de ingresso no Student nao substitui Ano Letivo da Matricula.
- Instituicao e Turno precisam estar ativos em novas matriculas.
- Nao existe duas matriculas do mesmo academico no mesmo Ano Letivo.
- Listagem de academicos mostra CPF mascarado.
- Auditoria administrativa nao deve registrar dados pessoais completos.

## Onibus, vinculos e vagas

A Sprint 4 implementa vinculos entre Matricula Anual e Onibus. Ocupacao e
disponibilidade sao sempre derivadas dos vinculos ativos do Ano Letivo
consultado.

Rotas:

- `GET /buses` inclui `occupiedSeats`, `availableSeats` e `isFull`
- `GET /buses/:id`
- `PATCH /buses/:id` bloqueia capacidade menor que ocupacao ativa
- `GET /buses/:id/assignments`
- `GET /enrollments/:enrollmentId/bus-assignment`
- `POST /enrollments/:enrollmentId/bus-assignment`
- `POST /enrollments/:enrollmentId/bus-assignment/release`
- `POST /enrollments/:enrollmentId/bus-assignment/switch`
- `GET /enrollments/:enrollmentId/bus-assignment-events`

Regras principais:

- Nao existe contador manual de ocupacao ou vagas disponiveis.
- Disponiveis = capacidade fisica do onibus - vinculos ativos.
- Ocupacao considera as Matriculas do Ano Letivo selecionado.
- Ano Letivo atual e usado como padrao operacional quando aplicavel.
- Onibus inativo nao recebe novos vinculos.
- Onibus lotado bloqueia novo vinculo.
- Matricula possui no maximo um vinculo ativo de onibus.
- Liberacao encerra vinculo ativo com motivo tecnico `RELEASED`.
- Troca encerra vinculo anterior com motivo tecnico `SWITCHED` e cria novo
  vinculo na mesma transacao.
- Falha na troca preserva o vinculo anterior ativo.
- Historico permanece legivel mesmo se o onibus for inativado depois.
- Auditoria administrativa registra eventos sem dados pessoais completos.

## Documentos privados

A Sprint 5 implementa documentos privados dos academicos. Arquivos ficam em
storage privado fora de `public` e fora do repositorio. O banco armazena apenas
metadados. A API nunca retorna `storageKey`, nome armazenado ou caminho fisico.

Variaveis:

- `DOCUMENT_STORAGE_DIR`: diretorio privado de storage. Padrao local:
  `/opt/codeacode/storage/atretu/private-documents`.
- `DOCUMENT_MAX_SIZE_BYTES`: limite por arquivo. Padrao: `8388608` bytes.

Tipos:

- `CPF`
- `RG`
- `PROOF_OF_ADDRESS`
- `PROOF_OF_ENROLLMENT`

Formatos aceitos:

- PDF com MIME/extensao/assinatura validos
- JPEG com MIME/extensao/assinatura validos
- PNG com MIME/extensao/assinatura validos

Rotas:

- `GET /students/:studentId/documents`
- `POST /students/:studentId/documents`
- `GET /students/:studentId/documents/:documentId`
- `POST /students/:studentId/documents/:documentId/replace`
- `GET /students/:studentId/documents/:documentId/file`
- `PATCH /students/:studentId/documents/:documentId/remove`

Regras principais:

- Ha no maximo um documento `ACTIVE` por tipo para cada academico.
- Substituicao preserva o arquivo anterior e marca o metadado como `REPLACED`.
- Remocao e logica: metadado vira `REMOVED` e o arquivo fisico permanece.
- Documento `REMOVED` nao pode ser baixado pela operacao comum.
- Upload e substituicao compensam falhas entre filesystem e PostgreSQL removendo
  arquivo novo quando a persistencia falha.
- Download protegido aplica `nosniff`, `no-store`, `no-referrer` e nome seguro
  gerado pelo sistema.
- Auditoria administrativa registra upload, substituicao, visualizacao/download
  e remocao sem dados pessoais completos.

## Pre-cadastro publico

A Sprint 6 implementa solicitacao publica de cadastro com aprovacao
administrativa. O pre-cadastro nao cria Academico, Pessoa definitiva,
Matricula, vinculo de Onibus, boleto, carteirinha, portal ou reserva de vaga
antes da aprovacao.

Rotas publicas:

- `GET /public/pre-registration/options`
- `POST /public/pre-registrations`

Rotas administrativas:

- `GET /pre-registrations`
- `GET /pre-registrations/:id`
- `GET /pre-registrations/:id/documents/:documentId/file`
- `POST /pre-registrations/:id/approve`
- `POST /pre-registrations/:id/reject`

## Ciclo de vida do academico e diretoria

A Sprint 7 implementa suspensao, reativacao, desligamento e participacao na
diretoria. A fonte da verdade para a situacao global e `Student.status`.
`Enrollment` continua representando o contexto academico anual, `BoardMembership`
representa participacao atual/historica na diretoria e `StudentHistoryEvent`
guarda historico funcional. Auditoria administrativa permanece em
`administrative_audit_logs`.

Rotas:

- `POST /students/:id/suspend`
- `POST /students/:id/reactivate`
- `POST /students/:id/terminate`
- `GET /students/:id/history`
- `GET /students/:id/board-memberships`
- `POST /students/:id/board-memberships`
- `POST /students/:id/board-memberships/:membershipId/end`

Regras principais:

- Suspensao exige motivo, justificativa e escolha explicita sobre liberar vaga.
- Suspensao pode manter o vinculo ativo de Onibus ou encerrar o vinculo com
  motivo tecnico `SUSPENSION`.
- Reativacao de suspensao com vaga mantida preserva o vinculo existente.
- Reativacao de suspensao com vaga liberada exige Onibus ativo com vaga.
- Desligamento aceita `WITHDRAWAL` ou `NON_PAYMENT`, exige justificativa,
  encerra vinculo ativo de Onibus com motivo `TERMINATION` e libera vaga.
- Desligamento tambem encerra BoardMembership ativo na mesma transacao.
- Diretoria ativa nao altera matricula nem Onibus, mas torna o academico
  inelegivel para futuros boletos.
- Elegibilidade futura para boleto e regra derivada: Student `ACTIVE` sem
  BoardMembership `ACTIVE`.
- Nao ha DELETE de academico.
- A Sprint 7 nao implementa financeiro, boletos, Sicredi, carteirinhas,
  rematricula, PDFs, portal, dashboard, notificacoes ou deploy.

Regras principais:

- CPF do interessado e obrigatorio, valido, normalizado e revalidado na
  aprovacao.
- Ha no maximo uma solicitacao `PENDING` por CPF.
- Solicitacao `REJECTED` preserva historico e permite novo envio futuro.
- Erros publicos de duplicidade usam mensagem generica para reduzir enumeracao
  de CPF.
- Honeypot preenchido retorna sucesso generico sem criar registro.
- Upload publico de documentos e opcional, usa storage privado, validacao de
  MIME/extensao/magic bytes/tamanho e nao reutiliza endpoints administrativos.
- Aprovacao e transacional: cria Person, Student, responsavel opcional,
  Enrollment e promove documentos temporarios para StudentDocument.
- Promocao documental nao duplica arquivo fisico; metadados definitivos apontam
  para o mesmo arquivo privado ja validado.
- Rejeicao exige motivo, registra auditoria e preserva documentos temporarios.
- Auditoria nao registra CPF, RG, endereco, payload bruto, storageKey ou path.

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

Smoke da Sprint 3, com API e banco ja disponiveis:

```bash
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:students
```

Smoke da Sprint 4, com API e banco ja disponiveis:

```bash
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:bus-assignments
```

Smoke da Sprint 5, com API, banco e storage privado ja disponiveis:

```bash
ADMIN_SETUP_TOKEN=... DATABASE_URL=... DOCUMENT_STORAGE_DIR=/tmp/atretu-documents-smoke DOCUMENT_MAX_SIZE_BYTES=1024 npm --prefix apps/api run smoke:documents
```

Smoke da Sprint 6, com API, banco e storage privado ja disponiveis:

```bash
ADMIN_SETUP_TOKEN=... DATABASE_URL=... DOCUMENT_STORAGE_DIR=/tmp/atretu-pre-registration-smoke DOCUMENT_MAX_SIZE_BYTES=1024 npm --prefix apps/api run smoke:pre-registrations
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:lifecycle
```

## Limites atuais
- Nao ha PDF de alunos por onibus.
- Nao ha suspensao, desligamento, diretoria ou rematricula completa.
- Nao ha integracao Sicredi.
- Nao ha consulta publica de status do pre-cadastro.
- Nao ha OCR, leitura automatica de documentos nem envio ao Sicredi.
- Nao ha portal do academico.
- Nao ha deploy.

## Documentacao de planejamento
Os documentos de planejamento estao no AI Office:

```text
/opt/codeacode/ai-office/projects/atretu
```
