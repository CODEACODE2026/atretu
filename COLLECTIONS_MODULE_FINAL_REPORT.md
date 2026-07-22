# Relatorio Final do Modulo de Cobranca e Inadimplencia

## 1. Objetivo do modulo

O modulo de Cobranca e Inadimplencia foi criado para permitir que usuarios autorizados acompanhem faturas vencidas, registrem acoes operacionais de cobranca e consultem o historico de contatos sem duplicar regras financeiras existentes.

O objetivo central e tratar cobranca como uma camada operacional derivada de `Invoice`, `BankSlip`, `Enrollment`, `Student` e `Institution`, preservando `Invoice` como fonte da verdade financeira e `BankSlip` como fonte da verdade bancaria.

## 2. Arquitetura

A arquitetura adotada e incremental e derivada:

- Backend NestJS dentro do modulo financeiro.
- Prisma como camada de persistencia.
- `CollectionAction` como unica entidade nova.
- `CollectionsService` como camada de regras e consultas derivadas.
- `CollectionsController` como camada HTTP fina.
- Frontend integrado ao painel Financeiro existente.
- API client centralizado em `apps/web/src/lib/api.ts`.
- UI de consulta em `collections-panel.tsx`.
- Formulario de acao separado em `collection-action-form.tsx`.

Nao foi criada entidade `CollectionCase`. O caso de cobranca e derivado da propria fatura.

## 3. Fluxo completo

1. Usuario `SUPER_ADMIN` ou `SECRETARIA` acessa Financeiro.
2. A aba Cobranca e Inadimplencia carrega resumo, fila e follow-ups.
3. A API identifica faturas vencidas com `Invoice.status = OPEN` e `dueDate` anterior ao dia atual.
4. O service monta dados derivados: atraso, aging, prioridade, status operacional, ultima acao e proximo follow-up.
5. O usuario aplica filtros e pagina usando dados oficiais da API.
6. O usuario abre o detalhe de uma fatura.
7. O frontend carrega detalhe, historico e boleto existente quando disponivel.
8. O usuario registra uma acao manual.
9. O backend cria `CollectionAction` e auditoria administrativa na mesma transacao.
10. O frontend recarrega historico, detalhe, fila, resumo e follow-ups por endpoints oficiais.
11. `Invoice` e `BankSlip` nao sofrem alteracao por acao de cobranca.

## 4. Modelos envolvidos

Modelos principais:

- `Invoice`: fonte financeira principal.
- `BankSlip`: estado bancario e boleto.
- `CollectionAction`: historico operacional de cobranca.
- `Student`: aluno.
- `Person`: dados pessoais e contato do aluno.
- `StudentGuardian`: responsavel, atualmente com nome e documentos.
- `Enrollment`: vinculo com instituicao e ano letivo.
- `Institution`: isolamento institucional.
- `AcademicYear`: filtro e contexto letivo.
- `User`: usuario autenticado que registra a acao.
- `AdministrativeAuditLog`: auditoria administrativa.

## 5. Controllers

Controller criado:

- `apps/api/src/finance/collections.controller.ts`

Endpoints:

- `GET /finance/collections/summary`
- `GET /finance/collections/cases`
- `GET /finance/collections/cases/:invoiceId`
- `GET /finance/collections/cases/:invoiceId/actions`
- `GET /finance/collections/follow-ups`
- `POST /finance/collections/cases/:invoiceId/actions`

O controller e fino: recebe params/query/body/usuario autenticado, valida DTOs e delega ao service.

## 6. Services

Service criado:

- `apps/api/src/finance/collections.service.ts`

Metodos publicos:

- `getSummary(filters, currentUser)`
- `listCases(filters, pagination, currentUser)`
- `getCaseByInvoiceId(invoiceId, currentUser)`
- `listActions(invoiceId, currentUser)`
- `createAction(invoiceId, dto, currentUser)`
- `listFollowUps(filters, currentUser)`

O service concentra regras de fila, status operacional, aging, prioridade, validacao de acao, isolamento institucional e auditoria.

## 7. DTOs

DTOs principais:

- `CollectionFiltersDto`
- `ListCollectionCasesDto`
- `CollectionInvoiceParamsDto`
- `CreateCollectionActionDto`

Enums expostos/derivados:

- `CollectionAgingBucket`
- `CollectionOperationalStatus`
- `CollectionPriority`
- `CollectionActionType`
- `CollectionChannel`

O body publico de criacao aceita somente:

- `actionType`
- `channel`
- `contactedName`
- `contactedDocumentMasked`
- `note`
- `promisedAmountCents`
- `promiseDueDate`
- `nextFollowUpAt`

Nao aceita `source`, `id`, `invoiceId`, `createdByUserId`, `createdAt`, status financeiro/bancario ou dados de auditoria.

## 8. Fluxo do frontend

Arquivos principais:

- `apps/web/src/app/admin/finance-panel.tsx`
- `apps/web/src/app/admin/collections-panel.tsx`
- `apps/web/src/app/admin/collection-action-form.tsx`
- `apps/web/src/app/admin/collection-action-validation.ts`
- `apps/web/src/app/admin/collection-formatters.ts`
- `apps/web/src/lib/api.ts`

Fluxo:

1. Financeiro exibe subarea Cobranca e Inadimplencia para roles autorizadas.
2. O painel carrega referencias, resumo, fila e follow-ups.
3. Filtros atualizam a fila e resetam pagina para 1.
4. `requestSeq` evita resposta antiga sobrescrevendo estado novo.
5. O detalhe abre em drawer/modal.
6. O historico e carregado por endpoint proprio de actions.
7. O formulario de acao abre separado do painel principal.
8. Apos sucesso, a UI recarrega dados oficiais, sem insercao otimista.

## 9. Regras de negocio

- A fila ativa inclui somente faturas `OPEN` vencidas.
- Faturas `PAID` e `CANCELLED` nao aparecem na fila ativa.
- O caso e derivado da fatura, nao persistido.
- Status operacional nao e persistido.
- Prioridade, dias de atraso e aging sao derivados.
- Acoes de cobranca sao historico operacional.
- Acao manual nao altera estado financeiro.
- Faturas pagas/canceladas permitem leitura de historico, mas bloqueiam nova acao.

## 10. Regras financeiras

O modulo nao altera regras financeiras existentes:

- Nao altera `Invoice.status`.
- Nao altera `BankSlip.status`.
- Nao altera `paidAmountCents`.
- Nao altera `paidAt`.
- Nao emite boleto.
- Nao cancela boleto.
- Nao sincroniza Sicredi.
- Nao da baixa.
- Nao cria evento financeiro.

Pagamento parcial em revisao e detectado por `BankSlip.providerErrorCode = PARTIAL_PAYMENT_REVIEW`.

## 11. Regras de seguranca

- Todos os endpoints usam `AuthGuard`.
- Todos os endpoints usam `RolesGuard`.
- Roles permitidas: `SUPER_ADMIN` e `SECRETARIA`.
- O usuario autenticado vem de `CurrentUser`.
- `createdByUserId` nao e aceito pelo body.
- `invoiceId` vem somente da rota.
- `source` e definido internamente como `MANUAL`.
- Campos desconhecidos no POST sao rejeitados.
- Documento completo em `contactedDocumentMasked` e rejeitado.
- Auditoria nao grava note completa nem documento sensivel.
- Frontend nao exibe stack trace tecnico.

## 12. Permissoes

Permissoes do modulo:

- `SUPER_ADMIN`: consulta e registra acoes.
- `SECRETARIA`: consulta e registra acoes.
- Demais usuarios: sem acesso visual e bloqueados pela API.

O frontend oculta a aba e o botao para usuarios sem permissao. O backend continua sendo a protecao definitiva.

## 13. Isolamento institucional

Todas as consultas atravessam `Invoice -> Enrollment -> Institution`.

O service aplica escopo institucional quando o `AuthUser` traz:

- `institutionId`
- `institutionIds`

Com escopo institucional presente:

- O usuario nao lista casos de outra instituicao.
- Nao consulta resumo escapando por `institutionId`.
- Nao abre detalhe de invoice fora do escopo.
- Nao lista actions de invoice fora do escopo.
- Nao cria action em invoice fora do escopo.

Risco conhecido: o `AuthUser` real ainda precisa carregar `institutionId/institutionIds` para que a restricao institucional seja efetiva para `SECRETARIA`.

## 14. Status operacionais

Status derivados:

- `OVERDUE_NO_ACTION`
- `CONTACTED`
- `PROMISE_ACTIVE`
- `PROMISE_BROKEN`
- `FOLLOW_UP_SCHEDULED`
- `NO_CONTACT`
- `PARTIAL_PAYMENT_REVIEW`
- `RESOLVED_BY_PAYMENT`
- `CANCELLED`

Precedencia:

1. `Invoice CANCELLED -> CANCELLED`
2. `Invoice PAID -> RESOLVED_BY_PAYMENT`
3. Pagamento parcial em revisao -> `PARTIAL_PAYMENT_REVIEW`
4. Promessa vencida com invoice aberta -> `PROMISE_BROKEN`
5. Follow-up futuro -> `FOLLOW_UP_SCHEDULED`
6. Promessa valida -> `PROMISE_ACTIVE`
7. Ultima acao `CONTACT_MADE` -> `CONTACTED`
8. Ultima acao `NO_CONTACT` ou `CONTACT_ATTEMPT` -> `NO_CONTACT`
9. Sem acao relevante -> `OVERDUE_NO_ACTION`

## 15. Aging

Faixas:

- `DAYS_1_30`: 1 a 30 dias.
- `DAYS_31_60`: 31 a 60 dias.
- `DAYS_61_90`: 61 a 90 dias.
- `DAYS_90_PLUS`: 91 dias ou mais.

Limites validados:

- 30 dias pertence a `DAYS_1_30`.
- 31 e 60 dias pertencem a `DAYS_31_60`.
- 61 e 90 dias pertencem a `DAYS_61_90`.
- 91 dias inicia `DAYS_90_PLUS`.

O calculo usa dia civil em UTC para evitar deslocamento por timezone.

## 16. Follow-ups

Follow-ups sao derivados de `CollectionAction.nextFollowUpAt`.

Regras:

- `FOLLOW_UP_SCHEDULED` exige `nextFollowUpAt`.
- Follow-ups podem ser futuros, de hoje ou atrasados.
- Quando ha multiplos follow-ups para a mesma invoice, o proximo retorno correto e escolhido por data.
- A listagem de follow-ups inclui atrasados para suportar o grupo visual "Atrasados".
- A fila principal considera o proximo retorno atual/futuro na derivacao operacional.

Frontend agrupa visualmente:

- Atrasados
- Hoje
- Amanha
- Proximos dias

## 17. Promessas

Promessas sao derivadas de acoes `PROMISE_TO_PAY`.

Regras:

- `PROMISE_TO_PAY` exige `promiseDueDate`.
- `promisedAmountCents` e opcional conforme regra atual.
- Valor, quando informado, deve ser inteiro positivo em centavos.
- Data de promessa e data civil.
- Promessa vencendo hoje e considerada ativa.
- Promessa vencida com invoice aberta vira `PROMISE_BROKEN`.
- Promessa mais recente prevalece.
- Promessa nao altera `Invoice` nem `BankSlip`.

No frontend, o usuario digita valor prometido em reais e a conversao para centavos ocorre apenas ao montar o body.

## 18. Auditoria

Evento usado:

- `COLLECTION_ACTION_CREATED`

Ao criar action:

- `CollectionAction` e `AdministrativeAuditLog` sao criados na mesma transacao.
- `domain`: `finance_collections`
- `recordId`: id da `CollectionAction`
- Metadata inclui ids e dados operacionais minimos.
- Metadata nao inclui note completa.
- Metadata nao inclui documento sensivel.

Rollback validado:

- Se auditoria falha, action nao fica persistida.
- Se action falha, auditoria nao e criada.

## 19. Testes implementados

Backend:

- Modelagem Prisma de `CollectionAction`.
- Service de cobranca.
- Controller de cobranca.
- Matriz de status operacional.
- Aging boundaries.
- Paginacao apos filtros derivados.
- Isolamento institucional.
- Criacao de todos os tipos de action.
- Validacoes de action.
- Transacao com auditoria.
- Ausencia de efeitos em `Invoice` e `BankSlip`.
- Permissoes e guards.

Frontend:

- Scripts estaticos de painel de cobranca.
- Scripts estaticos de formulario de action.
- Protecoes contra chamadas proibidas: sync, emissao, cancelamento, baixa e POST fora do API client.
- Typecheck, lint, build e suite disponivel.

## 20. QA realizado

QA tecnico:

- Revisao de paginacao e filtros derivados.
- Revisao de carregamento de actions sem N+1.
- Revisao de status, aging, promises, follow-ups e partial payment review.
- Revisao de seguranca do body.
- Revisao de auditoria/transacao.
- Revisao de ausencia de efeitos Sicredi.

Teste manual local:

- API e web subiram localmente.
- Banco temporario real foi criado e removido.
- Cenarios 1 a 11 foram executados.
- Validacoes negativas foram executadas.
- Chromium/CDP inspecionou UI real, drawer, formulario e responsividade basica.

Resultado: aprovado para homologacao.

## 21. Bugs encontrados durante desenvolvimento

- Necessidade de hardening de isolamento institucional no service quando `AuthUser` possuir `institutionId/institutionIds`.
- `contactedDocumentMasked` era validado no frontend, mas ainda precisava ser protegido no service.
- `listFollowUps` nao trazia retornos atrasados por padrao.
- Matriz de promessas, follow-ups e tipos de action precisava de cobertura explicita.
- `syncInvoiceBankSlip` foi identificado como chamada com efeito colateral e removido da area de cobranca.

## 22. Bugs encontrados durante homologacao

Durante o teste manual local da Tarefa 6 foi encontrado:

- O POST de action aceitava campos desconhecidos no body, como `createdByUserId`, `invoiceId` e `unexpected`, ignorando-os e criando a action.

Impacto:

- Nao permitia substituir usuario nem invoice.
- Ainda assim violava a regra de seguranca de rejeitar campos desconhecidos.

Status:

- Corrigido no commit `b2f89ccc68d3dbf2808b815aee535afd85e28f33`.

## 23. Correcoes realizadas

Correcoes principais:

- Criacao de `CollectionAction`.
- Service derivado de cobranca.
- Endpoints GET.
- Endpoint POST.
- Frontend de consulta.
- Frontend de registro manual.
- Hardening de isolamento institucional.
- Hardening de documento mascarado.
- Inclusao de follow-ups atrasados.
- Remocao de sync Sicredi da area de cobranca.
- Validacao explicita do body do POST com `ValidationPipe` e `expectedType`.

## 24. Riscos conhecidos

- `SECRETARIA` depende de `AuthUser.institutionId/institutionIds` para isolamento institucional efetivo.
- POST manual nao possui idempotency key; repeticao real de rede apos sucesso pode criar action duplicada.
- Frontend nao possui suite E2E/browser formal.
- Em Next dev podem aparecer GETs duplicados por montagem/dev runtime, sem loop observado.
- A navegacao administrativa global pode gerar rolagem horizontal em viewport estreito/tablet; nao foi alterada por estar fora do escopo do modulo.

## 25. Dividas tecnicas

- Popular `institutionId/institutionIds` no `AuthUser`.
- Criar E2E real de navegador para financeiro/cobranca.
- Avaliar idempotencia para POST manual de action.
- Avaliar otimizacao SQL/window functions se o volume de invoices/actions crescer.
- Padronizar Swagger/OpenAPI na API inteira antes de documentar endpoints formalmente.
- Revisar responsividade da navegacao administrativa global.

## 26. Melhorias futuras

Possiveis evolucoes, fora do escopo atual:

- Exportacao controlada de cobrancas.
- Idempotencia de criacao manual.
- Envio real de WhatsApp ou e-mail com trilha de auditoria.
- Filtros avancados por responsavel.
- Contatos especificos em `StudentGuardian`.
- Dashboard gerencial por instituicao.
- Relatorios de produtividade por usuario.
- Testes E2E com navegador.
- Otimizacao de queries derivadas para alto volume.

## 27. Checklist para producao

Antes de producao:

- Aplicar migrations em ambiente controlado.
- Confirmar `prisma generate`.
- Confirmar build API e web.
- Confirmar variaveis de ambiente.
- Confirmar `AuthUser.institutionId/institutionIds` se houver escopo institucional por secretaria.
- Confirmar roles `SUPER_ADMIN` e `SECRETARIA`.
- Confirmar storage de PDFs de boleto.
- Confirmar jobs Sicredi conforme politica do ambiente.
- Executar suite API.
- Executar suite frontend disponivel.
- Executar teste manual com usuario real.
- Conferir logs de API e browser.
- Nao habilitar automacoes de mensagem sem tarefa propria.

## 28. Checklist para futuras alteracoes no modulo

Antes de alterar cobranca:

- Nao persistir status operacional sem aprovacao.
- Nao alterar `Invoice.status` por action operacional.
- Nao alterar `BankSlip.status` por action operacional.
- Nao chamar Sicredi pela area de cobranca sem tarefa explicita.
- Nao enviar `source`, `createdByUserId` ou `invoiceId` no body publico.
- Manter auditoria sem note completa e sem documento sensivel.
- Atualizar testes de status, aging, promises e follow-ups.
- Atualizar scripts estaticos do frontend.
- Verificar paginacao apos filtros derivados.
- Verificar isolamento institucional.
- Rodar typecheck, lint, testes e builds.

## 29. Arquivos principais do modulo

Backend:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260721130000_add_collection_actions/migration.sql`
- `apps/api/src/finance/collections.service.ts`
- `apps/api/src/finance/collections.controller.ts`
- `apps/api/src/finance/dto/collections.dto.ts`
- `apps/api/src/finance/collections.service.spec.ts`
- `apps/api/src/finance/collections.controller.spec.ts`
- `apps/api/src/finance/collection-actions.schema.spec.ts`
- `apps/api/src/finance/finance.module.ts`

Frontend:

- `apps/web/src/lib/api.ts`
- `apps/web/src/app/admin/finance-panel.tsx`
- `apps/web/src/app/admin/collections-panel.tsx`
- `apps/web/src/app/admin/collection-action-form.tsx`
- `apps/web/src/app/admin/collection-action-validation.ts`
- `apps/web/src/app/admin/collection-formatters.ts`
- `apps/web/scripts/check-finance-collections-panel.mjs`
- `apps/web/scripts/check-finance-collection-action-form.mjs`

## 30. Resumo executivo

O modulo de Cobranca e Inadimplencia foi entregue como uma camada operacional segura sobre o financeiro existente.

Ele permite consultar inadimplencia, acompanhar aging, prioridade, status operacional, historico, promessas e follow-ups, alem de registrar acoes manuais de cobranca com auditoria transacional.

As regras financeiras permanecem preservadas: nenhuma action de cobranca altera fatura, boleto, baixa, pagamento, cancelamento, emissao ou sincronizacao Sicredi.

O modulo passou por QA tecnico, teste manual local com banco temporario real e validacoes finais de API/frontend/build.

Estado final:

- Codigo commitado ate a Tarefa 6.
- Modulo aprovado para homologacao.
- Documento final criado para manutencoes futuras.
- Nenhum push realizado.
