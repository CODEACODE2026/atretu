# Sprint 07 - Relatorio Final

## Status

Sprint 7 aprovado tecnicamente.

O Dashboard Administrativo foi implementado como primeira tela operacional do
painel administrativo do ATRETU, com backend agregado, cliente web tipado, tela
visual responsiva, integracao no AdminShell e QA final executado.

Nao houve commit nem push durante este sprint.

## Arquitetura Implementada

### Backend

- Novo modulo NestJS dedicado ao Dashboard:
  - `DashboardModule`
  - `DashboardController`
  - `DashboardService`
  - DTO/contrato em `dashboard.dto.ts`
- Endpoint agregado e somente leitura.
- Autenticacao com `AuthGuard`.
- Autorizacao com `RolesGuard`.
- Acesso permitido para:
  - `SUPER_ADMIN`
  - `SECRETARIA`
- Agregacoes feitas no backend para evitar multiplas chamadas do frontend.
- Consultas Prisma agrupadas, agregadas e independentes quando possivel.
- Reaproveitamento de regras existentes de cobranca via `CollectionsService`.
- Sem escrita no banco dentro do Dashboard.
- Sem chamada Sicredi dentro do Dashboard.

### Frontend

- Tipos completos do contrato adicionados ao cliente centralizado.
- Metodo unico para consumo dos dados do Dashboard:
  - `api.getAdminDashboard()`
- Novo componente visual:
  - `DashboardPanel`
- Integracao do Dashboard ao `AdminShell`.
- Dashboard definido como aba inicial do painel administrativo.
- Atalhos rapidos mapeados para abas reais ja existentes.
- Graficos implementados com HTML/CSS acessivel, sem biblioteca adicional.

## Endpoints Criados

### `GET /dashboard/overview`

Endpoint principal do Sprint 7.

Caracteristicas:

- Somente leitura.
- Protegido por autenticacao.
- Restrito a `SUPER_ADMIN` e `SECRETARIA`.
- Aceita filtros opcionais:
  - `academicYearId`
  - `institutionId`
- Retorna valores financeiros em centavos.
- Nao retorna CPF, RG, linha digitavel, codigo de barras, observacoes completas
  ou dados sensiveis.
- Nao chama Sicredi.
- Nao escreve no banco.

## Componentes React Criados

### `apps/web/src/app/admin/dashboard-panel.tsx`

Componente responsavel pela tela visual do Dashboard.

Inclui:

- Cabecalho da pagina.
- Ultima atualizacao baseada em `generatedAt`.
- Filtros por `academicYearId` e `institutionId`.
- Indicadores principais.
- Minha Agenda Hoje.
- Alertas criticos.
- Financeiro e cobranca.
- Academicos e documentacao.
- Onibus e vagas.
- Pre-cadastros.
- Carteirinhas pendentes.
- Grafico de inadimplencia por faixa.
- Grafico de ocupacao por onibus.
- Grafico de academicos por instituicao.
- Grafico adicional de pre-cadastros por mes.
- Atalhos rapidos.
- Loading com skeleton.
- Error state com acao de tentar novamente.
- Empty state geral e empty states parciais.

## Arquivos Criados

- `SPRINT_07_FINAL_REPORT.md`
- `apps/api/src/dashboard/dashboard.module.ts`
- `apps/api/src/dashboard/dashboard.controller.ts`
- `apps/api/src/dashboard/dashboard.service.ts`
- `apps/api/src/dashboard/dashboard.service.spec.ts`
- `apps/api/src/dashboard/dto/dashboard.dto.ts`
- `apps/web/src/app/admin/dashboard-panel.tsx`

## Arquivos Alterados

- `apps/api/package.json`
- `apps/api/src/app.module.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/app/admin/admin-shell.tsx`
- `apps/web/src/app/admin/finance-panel.tsx`

Durante o QA, tambem foram corrigidos:

- `apps/api/src/dashboard/dashboard.module.ts`
- `apps/web/src/app/admin/dashboard-panel.tsx`

## Decisoes Tecnicas Tomadas

- Criar um endpoint agregado unico para o Dashboard em vez de montar a tela com
  varias chamadas paginadas no frontend.
- Padronizar o endpoint como `GET /dashboard/overview`, conforme especificacao
  tecnica do Sprint 7.
- Manter o Dashboard somente leitura.
- Reutilizar `CollectionsService.getSummary`, `CollectionsService.listCases` e
  `CollectionsService.listFollowUps` para nao duplicar regras de cobranca.
- Usar Prisma com `count`, `aggregate`, `groupBy` e `findMany` controlados.
- Evitar N+1 usando consultas agrupadas e carregamentos em lote.
- Usar `Promise.all` apenas em consultas independentes.
- Manter valores financeiros como centavos no contrato.
- Usar `DOCUMENT_TYPES` como regra oficial centralizada para documentacao
  incompleta.
- Nao incluir foto na metrica de documentacao incompleta, pois foto possui fluxo
  proprio e nao faz parte do `missingTypes` oficial atual.
- Nao instalar `lucide-react` nem biblioteca de graficos, porque nao havia
  dependencia visual aprovada para esta tarefa.
- Implementar graficos com barras HTML/CSS acessiveis.
- Adicionar deduplicacao curta de requisicoes no DashboardPanel para evitar
  leituras duplicadas em remontagens rapidas.
- Manter o botao Atualizar e o retry com leitura forcada.

## Dependencias Reutilizadas

- NestJS.
- Prisma.
- Next.js.
- React.
- Tailwind CSS.
- Helpers existentes do cliente web:
  - `request`
  - `withParams`
  - tratamento centralizado de erro da API
- Helpers existentes de formatacao:
  - datas
  - status
  - valores monetarios
- `CollectionsService`.
- `DOCUMENT_TYPES`.
- `AuthGuard`.
- `RolesGuard`.
- `UsersModule`.

## Pendencias Conhecidas

- O projeto ainda nao possui biblioteca oficial de icones instalada no frontend.
  O Design System recomenda Lucide Icons, mas a instalacao ficou fora do escopo
  desta tarefa sem aprovacao explicita.
- O projeto ainda nao possui biblioteca de graficos instalada. Os graficos foram
  entregues com HTML/CSS acessivel.
- Os filtros visuais usam entrada por ID (`academicYearId` e `institutionId`)
  porque a tarefa proibiu chamadas adicionais para listar anos/instituicoes.
- O ambiente local estava com uma migration existente pendente. Foi aplicado
  `prisma migrate deploy` para alinhar a base local; nenhum arquivo de migration
  foi criado ou alterado.
- Nao ha script de coverage formal configurado no monorepo.

## Melhorias Futuras

- Instalar e padronizar `lucide-react`, se aprovado, para adequar os controles
  visuais ao Design System completo.
- Avaliar uma biblioteca leve de graficos, se os graficos precisarem de tooltip,
  eixos, legenda e interacao mais rica.
- Substituir filtros por ID por selects reais quando houver autorizacao para
  consumir listas auxiliares no Dashboard ou receber opcoes no proprio contrato.
- Adicionar testes E2E formais com Playwright.
- Adicionar script de coverage para medir linhas, branches e funcoes.
- Criar cache controlado ou revalidacao planejada para o Dashboard, se houver
  necessidade de reduzir carga em producao.
- Evoluir alertas com prioridades configuraveis.

## Limitacoes do MVP

- Dashboard apenas leitura.
- Sem acoes operacionais dentro dos cards/listas.
- Sem chamada Sicredi.
- Sem atualizacao em tempo real.
- Sem drill-down interno nos graficos.
- Sem selects auxiliares para filtros.
- Sem icones visuais por dependencia externa.
- Graficos usam barras HTML/CSS, sem engine dedicada.
- Coverage percentual e baseado em cenarios obrigatorios, nao em relatorio de
  cobertura de linhas.

## Impacto para o Sprint 8

O Sprint 8 pode partir de uma base administrativa mais consolidada:

- Dashboard ja e a primeira tela pos-login.
- Existe contrato agregado para indicadores operacionais.
- Atalhos ja conectam o Dashboard aos modulos existentes.
- Backend ja centraliza as metricas principais.
- Frontend ja tem tipos exportados para evolucoes futuras.

Possiveis frentes do Sprint 8:

- Refinar filtros com seletores reais.
- Adicionar icones oficiais.
- Evoluir visual dos graficos.
- Criar testes E2E.
- Criar painel de drill-down para alertas criticos.
- Melhorar governanca de performance e cache.

## Riscos Tecnicos

- Crescimento do Dashboard pode aumentar custo de consulta se novas metricas
  forem adicionadas sem agregacao.
- Graficos HTML/CSS atendem ao MVP, mas podem ficar limitados para comparacoes
  mais avancadas.
- Filtros por ID nao sao ergonomicos para usuario final.
- O modulo depende de regras existentes de cobranca; alteracoes futuras no
  `CollectionsService` podem afetar metricas do Dashboard.
- A falta de coverage formal dificulta medir cobertura real por linhas.
- Ambientes sem migrations aplicadas podem falhar em runtime.

## Checklist Final

- Backend do Dashboard criado: OK.
- Endpoint `GET /dashboard/overview`: OK.
- Autenticacao e autorizacao: OK.
- Acesso `SUPER_ADMIN`: OK.
- Acesso `SECRETARIA`: OK.
- Bloqueio sem autenticacao: OK.
- Bloqueio de role nao autorizada: OK.
- Contrato completo do MVP: OK.
- Indicadores principais: OK.
- Minha Agenda Hoje: OK.
- Alertas criticos: OK.
- Financeiro e cobranca: OK.
- Academicos e documentacao: OK.
- Onibus e vagas: OK.
- Pre-cadastros: OK.
- Carteirinhas pendentes: OK.
- Grafico de inadimplencia por faixa: OK.
- Grafico de ocupacao por onibus: OK.
- Grafico de academicos por instituicao: OK.
- Grafico adicional de pre-cadastros por mes: OK.
- Atalhos rapidos reais: OK.
- Dashboard como primeira tela do AdminShell: OK.
- Demais abas preservadas: OK.
- Responsividade desktop/tablet/celular: OK.
- Loading state: OK.
- Empty state: OK.
- Error state: OK.
- Sem dados sensiveis: OK.
- Sem escrita no banco pelo Dashboard: OK.
- Sem chamada Sicredi pelo Dashboard: OK.
- Sem N+1 identificado: OK.
- Sem dependencia nova: OK.
- Sem commit/push: OK.

## Cobertura de Testes

Nao ha relatorio formal de coverage por linhas/branches configurado no monorepo.

Cobertura por cenarios obrigatorios do Sprint 7: 100%.

Cenarios cobertos:

- Permissao `SUPER_ADMIN`.
- Permissao `SECRETARIA`.
- Bloqueio sem autenticacao.
- Bloqueio para role nao autorizada.
- Contrato completo da resposta.
- Cenario sem dados.
- Cenario com dados agregados.
- Filtro por `academicYearId`.
- Filtro por `institutionId`.
- Contagens de academicos.
- Pre-cadastros.
- Faturas vencidas.
- Valores financeiros em centavos.
- Reaproveitamento de `CollectionsService`.
- Follow-ups de hoje.
- Promessas vencidas.
- Boletos com atencao.
- Ocupacao por onibus.
- Documentacao incompleta usando `DOCUMENT_TYPES`.
- Carteirinhas pendentes.
- Ausencia de chamada Sicredi pelo Dashboard.
- Ausencia de escrita no banco pelo Dashboard.

## Metricas de Performance Observadas

### Build de Producao Web

Resultado de `npm run build -w @atretu/web`:

- Rota `/admin`: 42.4 kB.
- First Load JS da rota `/admin`: 149 kB.
- First Load JS compartilhado: 102 kB.
- Build concluido sem erros.

### QA Visual Headless

Validado com Chromium headless:

- Desktop: 1366x900.
- Tablet: 768x1024.
- Celular: 390x844.

Resultados observados:

- Sem erro de console.
- Sem erro de hidratacao.
- Sem erro de chave React.
- Sem scroll horizontal indevido.
- Foco e elementos interativos presentes.
- Graficos renderizados com `role=\"progressbar\"`.
- Ultima atualizacao visivel.

### Rede do Dashboard

- O frontend consome somente `GET /dashboard/overview` para os dados do
  Dashboard.
- Em ambiente browser local, a rede mostra `OPTIONS` de preflight CORS e o
  `GET /dashboard/overview`.
- Nao foram identificadas chamadas paralelas para outros endpoints para montar
  o Dashboard.

### Banco de Dados Local

Base local usada no QA continha dados reais:

- Academicos: 495.
- Matriculas: 536.
- Faturas: 231.
- Onibus: 156.
- Pre-cadastros: 72.
- Carteirinhas: 423.
- Documentos: 119.

Validacao filtrada por ano/instituicao real retornou:

- Status HTTP: 200.
- Academicos ativos: 1.
- Pontos no grafico de ocupacao por onibus: 115.
- Pontos no grafico de academicos por instituicao: 1.

## Validacoes Executadas

- `npm run typecheck`: passou.
- `npm run test`: passou.
- `npm run build`: passou.
- `npm run typecheck -w @atretu/api`: passou.
- `npx tsx src/dashboard/dashboard.service.spec.ts`: passou.
- `npm run test -w @atretu/api`: passou.
- `npm run build -w @atretu/api`: passou.
- `npm run typecheck -w @atretu/web`: passou.
- `npm run test -w @atretu/web`: passou.
- `npm run build -w @atretu/web`: passou.

## Encerramento

O Sprint 7 entrega o Dashboard Administrativo do ATRETU como primeira tela apos
login, com dados reais agregados, contrato tipado, UI responsiva, testes de API,
validacao funcional e build de producao.

Status final recomendado: APROVADO.
