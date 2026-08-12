# Sprint 12.14 - UX de criacao de fatura

## Decisao

O fluxo principal de criacao de fatura em `Financeiro > Faturas` deve usar modal aberto pelo botao `Nova fatura`.

Nao foi adicionada uma confirmacao global extra, porque o sistema nao utiliza esse padrao para a criacao manual de faturas. A revisao acontece dentro do proprio modal, antes do botao final `Criar fatura`, usando a previa existente de elegibilidade.

## Escopo preservado

- Backend de faturas preservado.
- Endpoint de busca de academicos preservado: `GET /students`.
- Busca preservada por nome, CPF e carteirinha quando suportado pelo backend.
- Limite de resultados preservado em 10 itens no fluxo de criacao.
- Criacao preservada via `POST /students/:studentId/invoices`.
- Previa preservada via `GET /students/:studentId/invoice-preview`.
- Regras financeiras preservadas: valor, vencimento, competencia por matricula/ano letivo, status inicial, instituicao, academico, auditoria, permissoes e integracao bancaria.

## Inelegibilidade

As regras atuais de inelegibilidade permanecem no backend e sao apresentadas pela previa:

- academico suspenso;
- academico desligado;
- academico com diretoria ativa;
- ano letivo inativo/arquivado.

O modal nao permite finalizar a criacao sem uma previa elegivel.

## Nova cobranca x Criar fatura

`Criar fatura` cria uma fatura financeira para um academico/matricula.

`Nova cobranca`, no modulo de cobrancas, registra acoes de cobranca e acompanhamento sobre casos financeiros existentes.

Os fluxos sao relacionados, mas nao foram unificados nesta Sprint. Qualquer consolidacao futura deve ser decidida em uma Sprint propria para evitar alterar regra financeira ou rotina operacional de cobranca silenciosamente.
