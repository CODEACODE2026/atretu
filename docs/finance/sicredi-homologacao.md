# Homologacao Sicredi

## Objetivo

Registrar o encerramento tecnico da homologacao do modulo Sicredi no Atretu,
incluindo os fluxos validados, o comportamento observado no Sandbox e as
pendencias que devem ser acompanhadas na entrada em Producao.

Este documento nao altera regra financeira, nao substitui contrato operacional
com o Sicredi e nao autoriza relaxamento de validacoes de pagamento.

## Fluxo de emissao

A emissao parte de uma `Invoice` aberta e cria um `BankSlip` local antes da
chamada externa. A persistencia local e feita em transacao, e a chamada ao
Sicredi ocorre fora da transacao para evitar manter locks de banco durante I/O
externo.

Quando o Sicredi confirma a emissao, o sistema atualiza o boleto com
`nossoNumero`, `linhaDigitavel`, `codigoBarras`, `issuedAt`, `lastCheckedAt` e
status `ISSUED`. Erros definitivos marcam `ISSUE_FAILED`; falhas incertas, como
timeout ou 5xx, preservam o boleto em estado conservador para revisao.

## Fluxo de sincronizacao

A sincronizacao consulta boletos Sicredi ainda elegiveis a mudanca de status,
especialmente boletos locais `ISSUED` vinculados a `Invoice` `OPEN`, no ambiente
configurado por `SICREDI_ENV`.

Cada consulta usa o Nosso Numero local e interpreta a resposta do provedor. Se o
provedor indicar liquidacao integral, o `BankSlip` passa para `PAID` e a
`Invoice` correspondente passa para `PAID`. Se o provedor indicar baixa
confirmada dentro das regras do sistema, o boleto e conciliado conforme o fluxo
de cancelamento.

Falhas por item sao registradas sem derrubar a execucao inteira do job. O resumo
do run persiste contadores como `scannedCount`, `updatedCount`,
`unchangedCount`, `paidCount`, `cancelledCount` e `errorCount`.

## Scheduler

O job `sicredi_open_issued_sync` e registrado pelo `BankSlipSyncJob` no
`SchedulerRegistry`. A ativacao e controlada por
`SICREDI_SYNC_OPEN_ISSUED_ENABLED`, o intervalo por
`SICREDI_SYNC_OPEN_ISSUED_INTERVAL_MS` e o limite por
`SICREDI_SYNC_OPEN_ISSUED_LIMIT`.

O callback do scheduler registra ticks e chama o mesmo metodo de sincronizacao
usado pelo fluxo manual. Assim, cron e botao manual compartilham a mesma regra
funcional.

## Batch

A emissao em lote cria `BankSlipIssueBatch` e seus itens para processar boletos
elegiveis. O fluxo institucional cria faturas faltantes, cria o lote, cria os
itens e dispara o processamento imediato depois do commit da transacao local.

O processamento do lote respeita idempotencia, retries, status dos itens e
controle de concorrencia. Itens emitidos deixam de aparecer como "Sem boleto" e
passam a exibir os dados bancarios retornados pelo Sicredi.

## Advisory Lock

Os jobs usam advisory locks no PostgreSQL para evitar execucoes sobrepostas e
processamento concorrente do mesmo escopo.

No sincronizador de boletos abertos/emitidos, se o lock nao for adquirido, o run
e registrado como `SKIPPED_ALREADY_RUNNING`. Nesse caso pode haver tick do
scheduler sem log de inicio funcional da sincronizacao, porque a execucao foi
bloqueada antes da busca de boletos elegiveis.

## Monitor de Jobs

O monitor interno exposto em `GET /admin/jobs/status` registra estado em memoria
dos jobs conhecidos, incluindo:

- `enabled`;
- `registered`;
- `intervalMs`;
- `tickCount`;
- `lastTickAt`;
- `lastRunStartedAt`;
- `lastRunFinishedAt`;
- `running`;
- `lastError`;
- `nextRunEstimatedAt`.

A tela administrativa "Monitor de Jobs" permite verificar rapidamente se um job
esta registrado, executando, parado, preso ou falhando.

## Tratamento de pagamento parcial

`PARTIAL_PAYMENT_REVIEW` ocorre quando o Sicredi retorna o boleto como
liquidado, mas o valor em `dadosLiquidacao.valor` e menor que
`originalAmountCents` local.

Nesse caso o sistema atualiza campos de acompanhamento do `BankSlip`, como
`providerStatus`, `paidAmountCents`, `paidAt` quando disponivel,
`lastCheckedAt`, `providerErrorCode` e `providerErrorMessage`, mas mantem a
fatura aberta para revisao operacional.

O objetivo e impedir que um pagamento menor que o valor devido quite uma fatura
automaticamente sem validacao humana. Esta protecao permanece correta e nao deve
ser removida por comportamento observado no Sandbox.

## Comportamento observado no Sandbox

Durante a homologacao, foi observado que boletos diferentes retornaram dados
identicos na consulta de status do Sicredi Sandbox:

- mesmo `nossoNumero`;
- mesma data de liquidacao;
- mesmo valor pago, R$ 80,00;
- mesmo `providerStatus`;
- resultado funcional `PARTIAL_PAYMENT_REVIEW` quando o valor original local era
  maior que R$ 80,00.

Isso e forte evidencia de massa simulada ou resposta fixa do Sandbox para esse
cenario de consulta. Entretanto, nao foi encontrada documentacao publica do
Sicredi afirmando oficialmente que esse comportamento ocorre para todos os
boletos consultados no Sandbox.

Portanto:

- o sistema nao deve alterar a regra financeira por causa do Sandbox;
- o tratamento atual permanece correto;
- a validacao definitiva ocorrera em Producao, com boletos reais e retorno real
  do banco.

## Pendencias para Producao

- Validar o primeiro boleto pago real.
- Validar pagamento parcial real.
- Validar cancelamento real.
- Validar liquidacao apos vencimento.
- Validar PIX integrado ao boleto.
- Confirmar com o Sicredi/cooperativa se existem massas ou parametros oficiais
  para simular cenarios especificos no ambiente de homologacao.
- Conferir se os status retornados em Producao permanecem compativeis com o
  mapeamento atual.

## Conclusao

A homologacao do modulo Sicredi foi considerada aprovada para o escopo validado:
emissao, sincronizacao automatica, emissao em lote, monitoramento de jobs,
advisory locks, tratamento de erros por item e protecao contra pagamento
parcial.

As pendencias listadas para Producao devem ser executadas sem alterar a regra
financeira previamente aprovada e sem desativar `PARTIAL_PAYMENT_REVIEW`.
