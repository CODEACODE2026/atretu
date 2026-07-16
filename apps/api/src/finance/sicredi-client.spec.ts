import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import {
  SicrediClient,
  SicrediClientError,
  type SicrediIssueBankSlipInput,
} from "./sicredi-client.js";
import type { SicrediConfig } from "./sicredi-config.js";

process.env.NODE_ENV = "test";

const config: SicrediConfig = {
  environment: "sandbox",
  authUrl: "https://sicredi.test/auth/openapi/token",
  baseUrl: "https://sicredi.test/sb",
  apiKey: "secret-api-key",
  username: "123456789",
  password: "secret-password",
  cooperativa: "6789",
  posto: "03",
  codigoBeneficiario: "12345",
  timeoutMs: 10,
  requirePayerAddress: false,
};

const issueInput: SicrediIssueBankSlipInput = {
  pagador: {
    tipoPessoa: "PESSOA_FISICA",
    documento: "12345678901",
    nome: "Aluno Teste",
  },
  especieDocumento: "RECIBO",
  seuNumero: "AT0000001",
  dataVencimento: "2026-08-10",
  valor: "120.50",
};

await testAccessTokenReuse();
await testTokenExpirationAcceptsNumericStrings();
await testTokenExpirationRejectsInvalidValues();
await testRefreshToken();
await testConcurrentAuthentication();
await testSafe401Retry();
await testAuthenticationHeadersKeepApiKeySeparateFromBearer();
await testOperationalUrlsPreserveBasePath();
await testAuthUrlIsUsedExactlyAsConfigured();
await testIssueBankSlip();
await testBeneficiaryCodePreservesLeadingZeros();
await testIssueTimeoutIsUncertainAndNotRetried();
await testIssueErrorsAreSanitized();
await testDevelopmentIssueDiagnosticsAreSanitized();
await testDevelopmentIssueFetchErrorsAreLoggedSafely();
await testGetBankSlip();
await testPaidDayPagination();
await testPaidDayPaginationLimit();
await testCancellation();
await testPdf();
await testPdfInvalidContentType();
await testPdfTooLarge();

async function testAccessTokenReuse() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    bankSlipResponse(),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  await client.getBankSlip("123456789");
  await client.getBankSlip("123456789");
  assert.equal(fetch.calls.filter((call) => call.url.includes("/auth/")).length, 1);
  assert.equal(fetch.calls.length, 3);
}

async function testTokenExpirationAcceptsNumericStrings() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", "300", "900"),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  const result = await client.getBankSlip("123456789");
  assert.equal(result.nossoNumero, "123456789");
}

async function testTokenExpirationRejectsInvalidValues() {
  for (const value of ["abc", "0", "-1", Number.NaN, undefined]) {
    const fetch = queueFetch([
      jsonResponse({
        access_token: "access-1",
        refresh_token: "refresh-1",
        expires_in: value,
        refresh_expires_in: 900,
      }),
    ]);
    const client = createClient(fetch);
    await assert.rejects(
      () => client.getBankSlip("123456789"),
      (error) =>
        error instanceof SicrediClientError &&
        error.code === "INVALID_RESPONSE" &&
        error.operation === "authenticate",
    );
  }
}

async function testRefreshToken() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 1, 900),
    bankSlipResponse(),
    tokenResponse("access-2", "refresh-2", 300, 900),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  await client.getBankSlip("123456789");
  await client.getBankSlip("123456789");
  const refreshBody = String(fetch.calls[2]?.body);
  assert.match(refreshBody, /grant_type=refresh_token/);
  assert.doesNotMatch(refreshBody, /secret-password/);
}

async function testAuthenticationHeadersKeepApiKeySeparateFromBearer() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  await client.getBankSlip("123456789");
  const authHeaders = new Headers(fetch.calls[0]?.headers);
  const apiHeaders = new Headers(fetch.calls[1]?.headers);
  assert.equal(authHeaders.get("x-api-key"), config.apiKey);
  assert.equal(authHeaders.get("context"), "COBRANCA");
  assert.equal(apiHeaders.get("x-api-key"), config.apiKey);
  assert.equal(apiHeaders.get("authorization"), "Bearer access-1");
}

async function testOperationalUrlsPreserveBasePath() {
  const noTrailingSlashFetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      cooperativa: "6789",
      posto: "03",
    }, 201),
  ]);
  const noTrailingSlashClient = createClient(noTrailingSlashFetch, {
    config: { ...config, baseUrl: "https://sicredi.test/sb" },
  });
  await noTrailingSlashClient.issueBankSlip(issueInput);
  assert.equal(
    noTrailingSlashFetch.calls[1]?.url,
    "https://sicredi.test/sb/cobranca/boleto/v1/boletos",
  );

  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125120315335103",
      cooperativa: "6789",
      posto: "03",
    }, 201),
    bankSlipResponse(),
    jsonResponse({
      transactionId: "tx-1",
      dataMovimento: "2026-08-10",
      codigoBeneficiario: "12345",
      nossoNumero: "123456789",
      cooperativa: "6789",
      posto: "03",
      statusComando: "MOVIMENTO_ENVIADO",
    }, 202),
    paidPageResponse(false),
  ]);
  const client = createClient(fetch, {
    config: { ...config, baseUrl: "https://sicredi.test/sb/" },
  });
  await client.issueBankSlip(issueInput);
  await client.getBankSlip("123456789");
  await client.requestCancellation("123456789");
  await client.listPaidBankSlipsByDay({ day: "10/08/2026" });
  assert.equal(fetch.calls[1]?.url, "https://sicredi.test/sb/cobranca/boleto/v1/boletos");
  assert.equal(
    fetch.calls[2]?.url,
    "https://sicredi.test/sb/cobranca/boleto/v1/boletos?codigoBeneficiario=12345&nossoNumero=123456789&data-movimento=true",
  );
  assert.equal(
    fetch.calls[3]?.url,
    "https://sicredi.test/sb/cobranca/boleto/v1/boletos/123456789/baixa",
  );
  assert.equal(
    fetch.calls[4]?.url,
    "https://sicredi.test/sb/cobranca/boleto/v1/boletos/liquidados/dia?codigoBeneficiario=12345&dia=10%2F08%2F2026&pagina=1",
  );
}

async function testAuthUrlIsUsedExactlyAsConfigured() {
  const authUrl = "https://sicredi.test/sb/auth/openapi/token";
  const fetch = queueFetch([tokenResponse("access-1", "refresh-1", 300, 900), bankSlipResponse()]);
  const client = createClient(fetch, {
    config: { ...config, authUrl, baseUrl: "https://sicredi.test/sb" },
  });
  await client.getBankSlip("123456789");
  assert.equal(fetch.calls[0]?.url, authUrl);
}

async function testConcurrentAuthentication() {
  const fetch = queueFetch([
    asyncJson({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 300, refresh_expires_in: 900 }),
    bankSlipResponse(),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  await Promise.all([client.getBankSlip("123456789"), client.getBankSlip("123456789")]);
  assert.equal(fetch.calls.filter((call) => call.url.includes("/auth/")).length, 1);
}

async function testSafe401Retry() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({ message: "UNAUTHORIZED" }, 401),
    tokenResponse("access-2", "refresh-2", 300, 900),
    bankSlipResponse(),
  ]);
  const client = createClient(fetch);
  const result = await client.getBankSlip("123456789");
  assert.equal(result.nossoNumero, "123456789");
  assert.equal(fetch.calls.filter((call) => call.url.includes("/auth/")).length, 2);
}

async function testIssueBankSlip() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      cooperativa: "6789",
      posto: "03",
    }, 201),
  ]);
  const client = createClient(fetch);
  const result = await client.issueBankSlip(issueInput);
  assert.equal(result.nossoNumero, "251006142");
  const body = JSON.parse(String(fetch.calls[1]?.body)) as Record<string, unknown>;
  assert.equal(body.tipoCobranca, "NORMAL");
  assert.equal(body.codigoBeneficiario, "12345");
  assert.equal(body.nossoNumero, undefined);
}

async function testBeneficiaryCodePreservesLeadingZeros() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      nossoNumero: "251006142",
      linhaDigitavel: "74891125110061420512803153351030188640000009990",
      codigoBarras: "74891886400000099901125100614205120315335103",
      cooperativa: "6789",
      posto: "03",
    }, 201),
  ]);
  const client = createClient(fetch, {
    config: { ...config, codigoBeneficiario: "00123" },
  });
  await client.issueBankSlip(issueInput);
  const body = JSON.parse(String(fetch.calls[1]?.body)) as Record<string, unknown>;
  assert.equal(body.codigoBeneficiario, "00123");
  assert.equal(typeof body.codigoBeneficiario, "string");
}

async function testIssueTimeoutIsUncertainAndNotRetried() {
  let issueCalls = 0;
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    async () => {
      issueCalls += 1;
      throw new DOMException("aborted", "AbortError");
    },
  ]);
  const client = createClient(fetch);
  await assert.rejects(
    () => client.issueBankSlip(issueInput),
    (error) =>
      error instanceof SicrediClientError &&
      error.operation === "issueBankSlip" &&
      error.uncertain &&
      error.code === "TIMEOUT",
  );
  assert.equal(issueCalls, 1);
}

async function testIssueErrorsAreSanitized() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      message: `Credencial ${config.password} token access-1 x-api-key ${config.apiKey}`,
      code: "422",
    }, 422),
  ]);
  const client = createClient(fetch);
  await assert.rejects(
    () => client.issueBankSlip(issueInput),
    (error) =>
      error instanceof SicrediClientError &&
      !error.message.includes(config.password) &&
      !error.message.includes(config.apiKey) &&
      !error.message.includes("access-1") &&
      error.statusCode === 422,
  );
}

async function testDevelopmentIssueDiagnosticsAreSanitized() {
  const development = await runIssueDiagnosticScenario("development");
  assertIssueDiagnosticLogIsSanitized(development.logs);

  const absent = await runIssueDiagnosticScenario(undefined);
  assertIssueDiagnosticLogIsSanitized(absent.logs);

  const production = await runIssueDiagnosticScenario("production");
  assert.equal(production.logs.length, 0);

  const test = await runIssueDiagnosticScenario("test");
  assert.equal(test.logs.length, 0);
}

async function runIssueDiagnosticScenario(nodeEnv: string | undefined) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousInfo = console.info;
  const logs: string[] = [];
  if (nodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = nodeEnv;
  }
  console.info = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      mensagem:
        `Boleto nao encontrado CPF ${issueInput.pagador.documento} nome ${issueInput.pagador.nome} ` +
        `endereco Rua Teste authorization Bearer access-1 x-api-key ${config.apiKey} senha ${config.password}`,
      codigo: "NOT_FOUND",
      authorization: "Bearer access-1",
      "x-api-key": config.apiKey,
      documento: issueInput.pagador.documento,
      nome: issueInput.pagador.nome,
      endereco: "Rua Teste",
    }, 404),
  ]);
  const client = createClient(fetch);
  try {
    await assert.rejects(
      () => client.issueBankSlip(issueInput),
      (error) =>
        error instanceof SicrediClientError &&
        error.operation === "issueBankSlip" &&
        error.statusCode === 404 &&
        error.providerStatus === 404 &&
        error.providerCode === "NOT_FOUND" &&
        error.providerMessage !== undefined &&
        !error.providerMessage.includes(config.password) &&
        !error.providerMessage.includes(config.apiKey) &&
        !error.providerMessage.includes("access-1") &&
        !error.providerMessage.includes(issueInput.pagador.documento) &&
        !error.providerMessage.includes(issueInput.pagador.nome) &&
        !error.providerMessage.includes("Rua Teste") &&
        !/Authorization/i.test(error.providerMessage) &&
        !/x-api-key/i.test(error.providerMessage) &&
        !/Bearer/i.test(error.providerMessage) &&
        error.requestUrl === "https://sicredi.test/sb/cobranca/boleto/v1/boletos",
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    console.info = previousInfo;
  }
  return { logs };
}

function assertIssueDiagnosticLogIsSanitized(logs: string[]) {
  assert.equal(logs.length, 3);
  const log = logs.join("\n");
  assert.match(log, /\[sicredi\.issueBankSlip\.diagnostic\]/);
  assert.match(log, /issueBankSlip/);
  assert.match(log, /"etapa":"client-entered"/);
  assert.match(log, /"etapa":"before-fetch"/);
  assert.match(log, /"etapa":"after-fetch"/);
  assert.match(log, /https:\/\/sicredi\.test\/sb\/cobranca\/boleto\/v1\/boletos/);
  assert.match(log, /"providerStatus":404/);
  assert.match(log, /"environment":"sandbox"/);
  assert.match(log, /"cooperativa":"6789"/);
  assert.match(log, /"posto":"03"/);
  assert.match(log, /"codigoBeneficiario":\{"digits":5,"last2":"45","leadingZeros":false\}/);
  assert.match(log, /"seuNumero":"AT0000001"/);
  assert.match(log, /"tipoCobranca":"NORMAL"/);
  assert.match(log, /"especieDocumento":"RECIBO"/);
  assert.match(log, /"dataVencimento":"2026-08-10"/);
  assert.match(log, /"valor":"120.50"/);
  assert.doesNotMatch(log, /secret-api-key/);
  assert.doesNotMatch(log, /secret-password/);
  assert.doesNotMatch(log, /access-1/);
  assert.doesNotMatch(log, /refresh-1/);
  assert.doesNotMatch(log, /12345678901/);
  assert.doesNotMatch(log, /Aluno Teste/);
  assert.doesNotMatch(log, /Rua Teste/);
  assert.doesNotMatch(log, /Authorization/i);
  assert.doesNotMatch(log, /x-api-key/i);
  assert.doesNotMatch(log, /Bearer/i);
}

async function testDevelopmentIssueFetchErrorsAreLoggedSafely() {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousInfo = console.info;
  const logs: string[] = [];
  process.env.NODE_ENV = "development";
  console.info = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    async () => {
      throw Object.assign(
        new Error(
          `Falha authorization Bearer access-1 x-api-key ${config.apiKey} senha ${config.password}`,
        ),
        { code: "ECONNRESET" },
      );
    },
  ]);
  const client = createClient(fetch);
  try {
    await assert.rejects(
      () => client.issueBankSlip(issueInput),
      (error) =>
        error instanceof SicrediClientError &&
        error.operation === "issueBankSlip" &&
        error.code === "NETWORK_ERROR",
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    console.info = previousInfo;
  }
  const log = logs.join("\n");
  assert.match(log, /"etapa":"client-entered"/);
  assert.match(log, /"etapa":"before-fetch"/);
  assert.match(log, /"etapa":"fetch-error"/);
  assert.match(log, /"errorName":"Error"/);
  assert.match(log, /"errorCode":"ECONNRESET"/);
  assert.doesNotMatch(log, /secret-api-key/);
  assert.doesNotMatch(log, /secret-password/);
  assert.doesNotMatch(log, /access-1/);
  assert.doesNotMatch(log, /Authorization/i);
  assert.doesNotMatch(log, /x-api-key/i);
  assert.doesNotMatch(log, /Bearer/i);
}

async function testGetBankSlip() {
  const fetch = queueFetch([tokenResponse("access-1", "refresh-1", 300, 900), bankSlipResponse()]);
  const client = createClient(fetch);
  const result = await client.getBankSlip("123456789");
  assert.equal(result.situacao, "LIQUIDADO");
  assert.equal(result.dadosLiquidacao?.valor, "120.50");
}

async function testPaidDayPagination() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    paidPageResponse(true),
    paidPageResponse(false),
  ]);
  const client = createClient(fetch);
  const pages = [];
  for await (const page of client.iteratePaidBankSlipsByDay({ day: "10/08/2026", maxPages: 3 })) {
    pages.push(page);
  }
  assert.equal(pages.length, 2);
  assert.equal(pages[0]?.items[0]?.valorLiquidado, "120.50");
  assert.match(fetch.calls[1]?.url ?? "", /pagina=1/);
  assert.match(fetch.calls[2]?.url ?? "", /pagina=2/);
}

async function testPaidDayPaginationLimit() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    paidPageResponse(true),
  ]);
  const client = createClient(fetch);
  await assert.rejects(
    async () => {
      for await (const _page of client.iteratePaidBankSlipsByDay({ day: "10/08/2026", maxPages: 1 })) {
        // consume generator
      }
    },
    /pagination exceeded/,
  );
}

async function testCancellation() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    jsonResponse({
      transactionId: "tx-1",
      dataMovimento: "2026-08-10",
      codigoBeneficiario: "12345",
      nossoNumero: "123456789",
      cooperativa: "6789",
      posto: "03",
      statusComando: "MOVIMENTO_ENVIADO",
      tipoMensagem: "BAIXA",
    }, 202),
  ]);
  const client = createClient(fetch);
  const result = await client.requestCancellation("123456789");
  assert.equal(result.statusComando, "MOVIMENTO_ENVIADO");
  assert.equal(fetch.calls[1]?.method, "PATCH");
}

async function testPdf() {
  const bytes = Buffer.from("%PDF-1.4\n%%EOF\n");
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    new Response(bytes, { status: 201, headers: { "content-type": "application/pdf" } }),
  ]);
  const client = createClient(fetch);
  const result = await client.getPdf("74891125110061420512803153351030188640000009990");
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.sizeBytes, bytes.byteLength);
  assert.match(result.filename, /^boleto-/);
}

async function testPdfInvalidContentType() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    new Response("{}", { status: 201, headers: { "content-type": "application/json" } }),
  ]);
  const client = createClient(fetch);
  await assert.rejects(() => client.getPdf("123"), /unsupported content type/);
}

async function testPdfTooLarge() {
  const fetch = queueFetch([
    tokenResponse("access-1", "refresh-1", 300, 900),
    new Response(Buffer.alloc(11), {
      status: 201,
      headers: { "content-type": "application/pdf", "content-length": "11" },
    }),
  ]);
  const client = createClient(fetch, { maxPdfBytes: 10 });
  await assert.rejects(() => client.getPdf("123"), /exceeds/);
}

function createClient(
  fetch: ReturnType<typeof queueFetch>,
  options: { config?: SicrediConfig; maxPdfBytes?: number } = {},
) {
  return new SicrediClient(options.config ?? config, {
    fetch,
    sleep: async () => {},
    maxAttempts: 2,
    maxPdfBytes: options.maxPdfBytes,
  });
}

function queueFetch(items: Array<Response | (() => Promise<Response>)>) {
  const calls: Array<{
    url: string;
    method?: string;
    body?: BodyInit | null;
    headers?: HeadersInit;
  }> = [];
  const fetch = async (input: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      body: init?.body ?? null,
      headers: init?.headers,
    });
    const item = items.shift();
    if (!item) {
      throw new Error("Unexpected fetch call");
    }
    return typeof item === "function" ? item() : item;
  };
  return Object.assign(fetch, { calls });
}

function tokenResponse(
  accessToken: string,
  refreshToken: string,
  expiresIn: number | string,
  refreshExpiresIn: number | string,
) {
  return jsonResponse({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    refresh_expires_in: refreshExpiresIn,
    token_type: "Bearer",
  });
}

function asyncJson(body: Record<string, unknown>) {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return jsonResponse(body);
  };
}

function bankSlipResponse() {
  return jsonResponse({
    nossoNumero: "123456789",
    seuNumero: "AT0000001",
    situacao: "LIQUIDADO",
    valorNominal: 120.5,
    dataVencimento: "2026-08-10",
    linhaDigitavel: "74891125110061420512803153351030188640000009990",
    codigoBarras: "74891886400000099901125100614205120315335103",
    dadosLiquidacao: {
      data: "2026-08-10T12:00:00.000Z",
      valor: 120.5,
      multa: 0,
      abatimento: 0,
      juros: 0,
      desconto: 0,
    },
  });
}

function paidPageResponse(hasNext: boolean) {
  return jsonResponse({
    items: [
      {
        nossoNumero: "123456789",
        seuNumero: "AT0000001",
        dataPagamento: "2026-08-10",
        valor: 120.5,
        valorLiquidado: 120.5,
        jurosLiquido: 0,
        descontoLiquido: 0,
        multaLiquida: 0,
        abatimentoLiquido: 0,
        tipoLiquidacao: "COMPE",
      },
    ],
    hasNext,
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
