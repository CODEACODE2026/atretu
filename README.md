# Atretu

Sistema administrativo para a Associacao Terrariquense de Estudantes Tecnicos e Universitarios.

## Status
Sprint 10: cadastros base, nucleo academico, vinculos de Onibus por Matricula
Anual, documentos privados, pre-cadastro publico com aprovacao administrativa,
suspensao, reativacao, desligamento, diretoria, rematricula anual e
carteirinhas com sequencias anuais e faturas internas manuais implementados.

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
  inelegivel para futuras faturas.
- Elegibilidade futura para fatura e regra derivada: Student `ACTIVE` sem
  BoardMembership `ACTIVE`.
- Nao ha DELETE de academico.
- A Sprint 7 nao implementa financeiro, boletos, Sicredi, carteirinhas,
  rematricula, PDFs, portal, dashboard, notificacoes ou deploy.

## Rematricula anual

A Sprint 8 implementa rematricula anual individual. A rematricula cria uma nova
`Enrollment` para o Ano Letivo de destino e preserva a matricula anterior. Ela
nao edita dados pessoais, nao duplica documentos, nao copia automaticamente
Onibus do ano anterior, nao gera boleto, nao gera carteirinha e nao toca em
financeiro.

Rotas:

- `GET /students/reenrollment-candidates`
- `GET /students/:id/reenrollment-preview`
- `POST /students/:id/reenroll`

Regras principais:

- O Ano Letivo atual e usado como padrao quando `academicYearId` nao e enviado.
- `Student ACTIVE` pode ser rematriculado.
- `Student SUSPENDED` exige reativacao antes da rematricula.
- `Student TERMINATED` nao pode ser rematriculado nesta Sprint.
- BoardMembership `ACTIVE` nao bloqueia rematricula.
- Cada academico continua podendo ter no maximo uma `Enrollment` por Ano Letivo.
- Instituicao e Turno precisam estar ativos.
- Onibus e opcional na rematricula.
- Se Onibus for selecionado, ele precisa estar ativo e ter vaga no Ano Letivo de
  destino.
- Criacao da `Enrollment`, `BusAssignment` opcional, historico funcional e
  auditorias acontece na mesma transacao.
- Falha por duplicidade, Onibus lotado ou referencia invalida nao deixa
  matricula parcial.
- O Onibus anterior aparece apenas como referencia operacional.
- Documentos seguem pelo modulo de documentos existente; comprovante de
  matricula novo pode ser substituido ali quando a Secretaria decidir.
- Auditoria administrativa registra IDs operacionais sem CPF, RG, endereco ou
  payload sensivel.

## Carteirinhas e sequencias anuais

A Sprint 9 implementa a fundacao funcional de carteirinhas sem PDF final,
impressao, QR Code ou validacao publica. A emissao e manual por Super Admin ou
Secretaria apos conferencia dos dados.

Rotas:

- `GET /student-cards`
- `GET /students/:studentId/cards`
- `GET /students/:studentId/card-preview`
- `POST /students/:studentId/cards`
- `POST /students/:studentId/cards/:cardId/invalidate`

Regras principais:

- Tipos suportados: `STUDENT` e `BOARD_MEMBER`.
- Status persistidos: `ACTIVE` e `INVALIDATED`.
- Sequencias sao independentes por Ano Letivo e tipo de carteirinha.
- `cardNumber` e formado por `sequenceNumber` concatenado ao ano, por exemplo
  `1` + `2026` = `12026`.
- `cardNumber` nao e globalmente unico; a identidade correta considera Ano
  Letivo, tipo e sequencia.
- Preview nao cria carteirinha, nao reserva numero e nao altera sequencia.
- Emissao usa transacao, lock da sequencia anual e rollback completo em falha.
- `STUDENT` exige academico `ACTIVE`, matricula valida e ausencia de diretoria
  ativa incompativel.
- `BOARD_MEMBER` exige academico `ACTIVE`, matricula valida e BoardMembership
  `ACTIVE`.
- Emissao de `BOARD_MEMBER` invalida `STUDENT` ativa do mesmo contexto anual na
  mesma transacao.
- Encerramento de diretoria invalida `BOARD_MEMBER` ativa relacionada, sem
  gerar `STUDENT` automaticamente.
- Suspensao nao invalida carteirinha; a validade fica derivada do status do
  academico.
- Reativacao reutiliza a carteirinha `ACTIVE` existente.
- Desligamento invalida carteirinhas ativas do academico na mesma transacao.
- Rematricula nao gera carteirinha automaticamente; a nova carteirinha referencia
  a nova `Enrollment` e o novo Ano Letivo.
- Historico funcional e auditoria registram emissao/invalidation sem CPF, RG,
  endereco, documentos ou payload sensivel.

## Faturas internas manuais

A Sprint 10 implementa `Invoice`, a obrigacao financeira interna do Atretu.
A Sprint 11 adiciona `BankSlip` como titulo bancario separado e vinculado 1:1
a `Invoice`, mantendo a separacao entre regra interna e integracao Sicredi.

Rotas:

- `GET /finance/invoices`
- `GET /finance/invoices/:id`
- `GET /students/:studentId/invoices`
- `GET /students/:studentId/invoice-preview`
- `POST /students/:studentId/invoices`
- `POST /finance/invoices/:id/cancel`

Regras principais:

- A geracao de fatura e manual por Super Admin ou Secretaria.
- `Invoice` referencia obrigatoriamente `Student` e `Enrollment`; Ano Letivo e
  Instituicao sao obtidos pela propria `Enrollment`, sem duplicacao no model.
- `ACTIVE` comum pode receber nova fatura.
- `SUSPENDED`, `TERMINATED` e BoardMembership `ACTIVE` bloqueiam nova fatura.
- Mudancas futuras de status do academico nao alteram faturas antigas.
- Valor e persistido em `amountCents`, inteiro positivo, sem float.
- Vencimento e data civil e pode estar no passado.
- Status persistidos: `OPEN`, `PAID` e `CANCELLED`.
- Vencida e condicao derivada de `OPEN` com `dueDate` anterior ao dia atual.
- Idempotencia usa `idempotencyKey` unica; mesma chave com mesmo payload retorna
  a fatura existente e payload diferente retorna conflito.
- Cancelamento interno exige fatura `OPEN`, motivo, registra `cancelledAt`,
  `cancelledByUserId`, historico funcional e auditoria; nao exclui fisicamente
  e nao representa cancelamento bancario futuro.
- Historico funcional e auditoria registram IDs operacionais sem CPF, RG,
  endereco, documentos, dados bancarios ou payload sensivel.

## Boletos Sicredi

A integracao da Sprint 11 e exclusiva Sicredi. O `SicrediClient` cuida apenas
de transporte HTTP, autenticacao, token/refresh, parsing seguro de JSON/PDF e
erros sanitizados. O `BankSlipsService` concentra regra de negocio,
persistencia, historico e auditoria. O frontend administrativo consome somente
os endpoints internos do Atretu e nunca chama URLs Sicredi diretamente.

Variaveis de ambiente:

```text
SICREDI_ENV=sandbox
SICREDI_AUTH_URL=https://...
SICREDI_BASE_URL=https://...
SICREDI_API_KEY=...
SICREDI_USERNAME=...
SICREDI_PASSWORD=...
SICREDI_COOPERATIVA=0000
SICREDI_POSTO=00
SICREDI_CODIGO_BENEFICIARIO=00000
SICREDI_HTTP_TIMEOUT_MS=10000
SICREDI_REQUIRE_PAYER_ADDRESS=false
```

Regras principais:

- Emissao cria `BankSlip` `PENDING_ISSUE` em transacao local, chama Sicredi fora
  da transacao e depois confirma `ISSUED` com `nossoNumero`, `linhaDigitavel`,
  `codigoBarras`, `issuedAt` e `lastCheckedAt`.
- `seuNumero` usa prefixo `A` + sequencia numerica de 9 digitos. A proxima
  sequencia e calculada por `MAX(seuNumero) + 1` por provider/ambiente, dentro
  de transacao protegida por `pg_advisory_xact_lock(7811003)`. A unique
  `(provider, environment, seuNumero)` permanece como protecao final.
- Nao ha retry cego de POST de emissao. Timeout, conexao interrompida ou
  resposta 5xx/504 incerta marcam `BankSlip.UNKNOWN`, preservam erro
  sanitizado e bloqueiam nova emissao automatica para a mesma `Invoice`.
- Erro definitivo de emissao marca `ISSUE_FAILED`, com codigo/mensagem
  sanitizados. Reemissao automatica continua bloqueada pelo vinculo 1:1.
- Consulta individual usa Nosso Numero e atualiza `providerStatus`,
  `lastCheckedAt` e campos retornados. Mudanca para liquidado marca
  `BankSlip.PAID` e `Invoice.PAID` de forma idempotente.
- Consulta de liquidados por dia e restrita a `SUPER_ADMIN`, pagina com limite
  de seguranca, localiza por `nossoNumero` ou `seuNumero` e nao cria boletos
  novos para registros desconhecidos.
- Baixa exige motivo administrativo, grava `cancellationRequestedAt`,
  `cancellationRequestedByUserId`, `cancellationReason` e `cancellationNote`
  no proprio `BankSlip`, marca `PENDING_CANCELLATION` e so confirma
  `CANCELLED` no sync posterior. A `Invoice` e cancelada apenas apos
  confirmacao bancaria.
- PDF e buscado sob demanda via endpoint protegido, nao e salvo em banco/disco
  e responde com `Content-Type: application/pdf`, `Cache-Control: no-store,
  private` e `X-Content-Type-Options: nosniff`.
- Auditoria e historico nao registram CPF, linha digitavel completa, codigo de
  barras completo, token, refresh token, `x-api-key`, senha ou payload bruto.
- `x-api-key` e a chave do Portal do Desenvolvedor e e diferente do
  `access_token`; chamadas autenticadas usam os dois: `x-api-key` e
  `Authorization: Bearer <access_token>`. A autenticacao usa `context=COBRANCA`
  e `scope=cobranca`; o refresh usa apenas `refresh_token`, sem reenviar
  usuario/senha.
- `SICREDI_USERNAME` deve ser configurado conforme o manual 3.3 como codigo do
  beneficiario + codigo da cooperativa. O sistema nao concatena esse valor em
  runtime; ele deve vir pronto e validado na configuracao operacional.
- A expiracao de token aceita `expires_in` e `refresh_expires_in` como numero ou
  string numerica positiva. Valor ausente, zero, negativo ou nao numerico e
  rejeitado como resposta invalida.
- A especie `RECIBO` e provisoria para Sandbox e deve ser validada antes de
  producao. CEP/UF/endereco/cidade podem ser obrigatorios conforme o cadastro do
  beneficiario; quando `SICREDI_REQUIRE_PAYER_ADDRESS=true`, o sistema exige
  endereco, cidade, UF com 2 letras e CEP com 8 digitos, sem inventar dados.
- Nome, endereco, cidade, telefone e e-mail do pagador seguem limites
  conservadores antes do envio para reduzir rejeicoes no Sicredi.
- Vencimento retroativo nao e aceito para emissao de boleto, embora faturas
  retroativas possam existir internamente sem boleto.
- Baixa com retorno `202` ou `MOVIMENTO_ENVIADO` nao significa baixa concluida:
  o boleto permanece `PENDING_CANCELLATION` ate confirmacao em consulta
  posterior. Timeout/5xx na baixa tambem exige sincronizacao posterior.
- Webhook, polling, Pix, QR Code, boleto hibrido, juros, multa, desconto,
  split, alteracao de vencimento e envio em lote ficam fora da Sprint 11.

Smoke local com mock Sicredi, sem Sandbox real:

```bash
DATABASE_URL=... ADMIN_SETUP_TOKEN=... JWT_SECRET=... npm --prefix apps/api run smoke:bank-slips
```

O smoke sobe uma API local temporaria, usa PostgreSQL local e um mock HTTP
Sicredi deterministico para validar emissao, consulta, pagamento, baixa, PDF,
autorizacao, concorrencia, resultado incerto, historico e auditoria.

Smoke Sandbox real deve ser executado somente manualmente, fora da validacao
obrigatoria local, com credenciais de homologacao e confirmacao explicita:

```bash
SICREDI_ENV=sandbox \
RUN_SICREDI_SANDBOX_SMOKE=true \
SICREDI_AUTH_URL=... \
SICREDI_BASE_URL=... \
SICREDI_API_KEY=... \
SICREDI_USERNAME=... \
SICREDI_PASSWORD=... \
SICREDI_COOPERATIVA=0000 \
SICREDI_POSTO=00 \
SICREDI_CODIGO_BENEFICIARIO=00000 \
npm --prefix apps/api run smoke:bank-slips:sandbox
```

Se `RUN_SICREDI_SANDBOX_SMOKE=true` nao estiver presente, qualquer smoke real
de homologacao deve abortar antes de chamar o Sicredi. Nao usar credenciais de
producao neste fluxo.

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
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:reenrollment
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:student-cards
ADMIN_SETUP_TOKEN=... DATABASE_URL=... npm --prefix apps/api run smoke:invoices
ADMIN_SETUP_TOKEN=... DATABASE_URL=... JWT_SECRET=... npm --prefix apps/api run smoke:bank-slips
```

## Limites atuais
- Nao ha PDF de alunos por onibus.
- Nao ha rematricula em lote.
- Nao ha PDF definitivo, impressao, QR Code ou validacao publica de carteirinha.
- Nao ha webhook bancario, polling, Pix, QR Code, boleto hibrido, juros, multa,
  desconto, split, alteracao de vencimento ou envio financeiro em lote.
- Nao ha consulta publica de status do pre-cadastro.
- Nao ha OCR, leitura automatica de documentos nem envio ao Sicredi.
- Nao ha portal do academico.
- Nao ha deploy.

## Documentacao de planejamento
Os documentos de planejamento estao no AI Office:

```text
/opt/codeacode/ai-office/projects/atretu
```
