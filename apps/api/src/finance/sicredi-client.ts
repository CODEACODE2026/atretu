import { Buffer } from "node:buffer";
import type { SicrediConfig } from "./sicredi-config.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type SleepLike = (ms: number) => Promise<void>;

type SicrediToken = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
};

type RequestOptions = {
  operation: SicrediOperation;
  method: "GET" | "POST" | "PATCH";
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  authenticated?: boolean;
  safeToRetry?: boolean;
  uncertainOnFailure?: boolean;
};

export type SicrediOperation =
  | "authenticate"
  | "refreshToken"
  | "issueBankSlip"
  | "getBankSlip"
  | "listPaidBankSlipsByDay"
  | "requestCancellation"
  | "getPdf";

export type SicrediPayer = {
  tipoPessoa: "PESSOA_FISICA" | "PESSOA_JURIDICA";
  documento: string;
  nome: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
};

export type SicrediIssueBankSlipInput = {
  pagador: SicrediPayer;
  especieDocumento: string;
  seuNumero: string;
  dataVencimento: string;
  valor: string;
};

export type SicrediIssueBankSlipResponse = {
  nossoNumero: string;
  linhaDigitavel: string;
  codigoBarras: string;
  cooperativa: string;
  posto: string;
  txid?: string;
  qrCode?: string;
};

export type SicrediBankSlipDetails = {
  nossoNumero: string;
  seuNumero: string;
  situacao: string;
  valorNominal: string;
  dataVencimento: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  dataEmissao?: string;
  dataMovimento?: string;
  dadosLiquidacao?: {
    data?: string;
    valor?: string;
    multa?: string;
    abatimento?: string;
    juros?: string;
    desconto?: string;
  };
};

export type SicrediPaidBankSlip = {
  nossoNumero: string;
  seuNumero: string;
  dataPagamento: string;
  valor: string;
  valorLiquidado: string;
  jurosLiquido?: string;
  descontoLiquido?: string;
  multaLiquida?: string;
  abatimentoLiquido?: string;
  tipoLiquidacao?: string;
};

export type SicrediPaidBankSlipsPage = {
  items: SicrediPaidBankSlip[];
  hasNext: boolean;
};

export type SicrediCancellationResponse = {
  transactionId: string;
  dataMovimento: string;
  codigoBeneficiario: string;
  nossoNumero: string;
  cooperativa: string;
  posto: string;
  statusComando: string;
  dataHoraRegistro?: string;
  tipoMensagem?: string;
};

export type SicrediPdfResponse = {
  bytes: Buffer;
  contentType: string;
  sizeBytes: number;
  filename: string;
};

export class SicrediClientError extends Error {
  readonly operation: SicrediOperation;
  readonly statusCode?: number;
  readonly code?: string;
  readonly transient: boolean;
  readonly uncertain: boolean;

  constructor(input: {
    operation: SicrediOperation;
    message: string;
    statusCode?: number;
    code?: string;
    transient?: boolean;
    uncertain?: boolean;
  }) {
    super(input.message);
    this.name = "SicrediClientError";
    this.operation = input.operation;
    this.statusCode = input.statusCode;
    this.code = input.code;
    this.transient = input.transient ?? false;
    this.uncertain = input.uncertain ?? false;
  }
}

export class SicrediClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepLike;
  private readonly maxAttempts: number;
  private readonly maxPdfBytes: number;
  private token?: SicrediToken;
  private authPromise?: Promise<SicrediToken>;

  constructor(
    private readonly config: SicrediConfig,
    options: {
      fetch?: FetchLike;
      sleep?: SleepLike;
      maxAttempts?: number;
      maxPdfBytes?: number;
    } = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxAttempts = options.maxAttempts ?? 2;
    this.maxPdfBytes = options.maxPdfBytes ?? 5 * 1024 * 1024;
  }

  async issueBankSlip(
    input: SicrediIssueBankSlipInput,
  ): Promise<SicrediIssueBankSlipResponse> {
    const response = await this.requestJson<Record<string, unknown>>({
      operation: "issueBankSlip",
      method: "POST",
      path: "/cobranca/boleto/v1/boletos",
      authenticated: true,
      safeToRetry: false,
      uncertainOnFailure: true,
      headers: this.beneficiaryHeaders(),
      body: {
        tipoCobranca: "NORMAL",
        codigoBeneficiario: this.config.codigoBeneficiario,
        pagador: input.pagador,
        especieDocumento: input.especieDocumento,
        seuNumero: input.seuNumero,
        dataVencimento: input.dataVencimento,
        valor: input.valor,
      },
    });
    return {
      nossoNumero: readString(response, "nossoNumero"),
      linhaDigitavel: readString(response, "linhaDigitavel"),
      codigoBarras: readString(response, "codigoBarras"),
      cooperativa: readString(response, "cooperativa"),
      posto: readString(response, "posto"),
      txid: readOptionalString(response, "txid"),
      qrCode: readOptionalString(response, "qrCode"),
    };
  }

  async getBankSlip(nossoNumero: string): Promise<SicrediBankSlipDetails> {
    const response = await this.requestJson<Record<string, unknown>>({
      operation: "getBankSlip",
      method: "GET",
      path: "/cobranca/boleto/v1/boletos",
      authenticated: true,
      safeToRetry: true,
      headers: this.beneficiaryHeaders(),
      query: {
        codigoBeneficiario: this.config.codigoBeneficiario,
        nossoNumero,
        "data-movimento": true,
      },
    });
    return {
      nossoNumero: readString(response, "nossoNumero"),
      seuNumero: readString(response, "seuNumero"),
      situacao: readString(response, "situacao", "situação"),
      valorNominal: readDecimalString(response, "valorNominal"),
      dataVencimento: readString(response, "dataVencimento"),
      linhaDigitavel: readOptionalString(response, "linhaDigitavel"),
      codigoBarras: readOptionalString(response, "codigoBarras"),
      dataEmissao: readOptionalString(response, "dataEmissao"),
      dataMovimento: readOptionalString(response, "dataMovimento"),
      dadosLiquidacao: readLiquidation(response.dadosLiquidacao),
    };
  }

  async listPaidBankSlipsByDay(input: {
    day: string;
    page?: number;
    cpfCnpjBeneficiarioFinal?: string;
  }): Promise<SicrediPaidBankSlipsPage> {
    const response = await this.requestJson<Record<string, unknown>>({
      operation: "listPaidBankSlipsByDay",
      method: "GET",
      path: "/cobranca/boleto/v1/boletos/liquidados/dia",
      authenticated: true,
      safeToRetry: true,
      headers: {
        ...this.beneficiaryHeaders(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      query: {
        codigoBeneficiario: this.config.codigoBeneficiario,
        dia: input.day,
        pagina: input.page ?? 1,
        cpfCnpjBeneficiarioFinal: input.cpfCnpjBeneficiarioFinal,
      },
    });
    const items = Array.isArray(response.items) ? response.items : [];
    return {
      items: items.map((item) => this.toPaidBankSlip(item)),
      hasNext: readBoolean(response, "hasNext"),
    };
  }

  async *iteratePaidBankSlipsByDay(input: {
    day: string;
    cpfCnpjBeneficiarioFinal?: string;
    maxPages?: number;
  }): AsyncGenerator<SicrediPaidBankSlipsPage> {
    const maxPages = input.maxPages ?? 20;
    for (let page = 1; page <= maxPages; page += 1) {
      const result = await this.listPaidBankSlipsByDay({
        day: input.day,
        page,
        cpfCnpjBeneficiarioFinal: input.cpfCnpjBeneficiarioFinal,
      });
      yield result;
      if (!result.hasNext) {
        return;
      }
    }
    throw new SicrediClientError({
      operation: "listPaidBankSlipsByDay",
      message: "Sicredi pagination exceeded the configured safety limit",
      code: "PAGINATION_LIMIT_EXCEEDED",
      transient: false,
    });
  }

  async requestCancellation(nossoNumero: string): Promise<SicrediCancellationResponse> {
    const response = await this.requestJson<Record<string, unknown>>({
      operation: "requestCancellation",
      method: "PATCH",
      path: `/cobranca/boleto/v1/boletos/${encodeURIComponent(nossoNumero)}/baixa`,
      authenticated: true,
      safeToRetry: false,
      headers: {
        ...this.beneficiaryHeaders(),
        codigoBeneficiario: this.config.codigoBeneficiario,
      },
    });
    return {
      transactionId: readString(response, "transactionId"),
      dataMovimento: readString(response, "dataMovimento"),
      codigoBeneficiario: readString(response, "codigoBeneficiario"),
      nossoNumero: readString(response, "nossoNumero"),
      cooperativa: readString(response, "cooperativa"),
      posto: readString(response, "posto"),
      statusComando: readString(response, "statusComando"),
      dataHoraRegistro: readOptionalString(response, "dataHoraRegistro"),
      tipoMensagem: readOptionalString(response, "tipoMensagem"),
    };
  }

  async getPdf(linhaDigitavel: string): Promise<SicrediPdfResponse> {
    const response = await this.request({
      operation: "getPdf",
      method: "GET",
      path: "/cobranca/boleto/v1/boletos/pdf",
      authenticated: true,
      safeToRetry: true,
      query: { linhaDigitavel },
    });
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (contentType !== "application/pdf" && contentType !== "application/octet-stream") {
      throw new SicrediClientError({
        operation: "getPdf",
        message: "Sicredi PDF response has an unsupported content type",
        statusCode: response.status,
        code: "INVALID_CONTENT_TYPE",
      });
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > this.maxPdfBytes) {
      throw new SicrediClientError({
        operation: "getPdf",
        message: "Sicredi PDF response exceeds the maximum allowed size",
        statusCode: response.status,
        code: "RESPONSE_TOO_LARGE",
      });
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > this.maxPdfBytes) {
      throw new SicrediClientError({
        operation: "getPdf",
        message: "Sicredi PDF response exceeds the maximum allowed size",
        statusCode: response.status,
        code: "RESPONSE_TOO_LARGE",
      });
    }
    return {
      bytes,
      contentType,
      sizeBytes: bytes.byteLength,
      filename: `boleto-${sanitizeFileToken(linhaDigitavel)}.pdf`,
    };
  }

  private async requestJson<T>(options: RequestOptions): Promise<T> {
    const response = await this.request(options);
    const text = await response.text();
    try {
      return (text ? JSON.parse(text) : {}) as T;
    } catch {
      throw new SicrediClientError({
        operation: options.operation,
        message: "Sicredi response was not valid JSON",
        statusCode: response.status,
        code: "INVALID_JSON",
      });
    }
  }

  private async request(options: RequestOptions): Promise<Response> {
    let attempt = 0;
    let lastError: SicrediClientError | undefined;
    while (attempt < this.resolveMaxAttempts(options)) {
      attempt += 1;
      try {
        const response = await this.rawRequest(options);
        if (response.status === 401 && options.authenticated && options.safeToRetry && attempt === 1) {
          this.token = undefined;
          continue;
        }
        if (!response.ok) {
          const error = await this.toHttpError(response, options);
          if (!this.shouldRetry(error, options, attempt)) {
            throw error;
          }
          lastError = error;
          await this.waitBeforeRetry(response, attempt);
          continue;
        }
        return response;
      } catch (error) {
        const normalized = this.toClientError(error, options);
        if (!this.shouldRetry(normalized, options, attempt)) {
          throw normalized;
        }
        lastError = normalized;
        await this.waitBeforeRetry(undefined, attempt);
      }
    }
    throw lastError;
  }

  private async rawRequest(options: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (options.authenticated) {
      headers.Authorization = `Bearer ${await this.getAccessToken()}`;
      headers["x-api-key"] = this.config.apiKey;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      return await this.fetchImpl(this.buildUrl(options.path, options.query), {
        method: options.method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      throw this.toNetworkError(error, options);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.token.expiresAt - 20_000 > now) {
      return this.token.accessToken;
    }
    if (!this.authPromise) {
      this.authPromise = this.authenticate().finally(() => {
        this.authPromise = undefined;
      });
    }
    this.token = await this.authPromise;
    return this.token.accessToken;
  }

  private async authenticate(): Promise<SicrediToken> {
    const now = Date.now();
    if (this.token && this.token.refreshExpiresAt - 20_000 > now) {
      try {
        return await this.requestToken("refreshToken", {
          grant_type: "refresh_token",
          refresh_token: this.token.refreshToken,
        });
      } catch (error) {
        if (!(error instanceof SicrediClientError) || error.statusCode !== 401) {
          throw error;
        }
      }
    }
    return this.requestToken("authenticate", {
      grant_type: "password",
      username: this.config.username,
      password: this.config.password,
      scope: "cobranca",
    });
  }

  private async requestToken(
    operation: "authenticate" | "refreshToken",
    body: Record<string, string>,
  ): Promise<SicrediToken> {
    try {
      const response = await this.fetchForm(operation, body);
      const json = (await response.json()) as Record<string, unknown>;
      const now = Date.now();
      return {
        accessToken: readString(json, "access_token"),
        refreshToken: readString(json, "refresh_token"),
        expiresAt: now + readPositiveNumber(json, "expires_in") * 1000,
        refreshExpiresAt: now + readPositiveNumber(json, "refresh_expires_in") * 1000,
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Missing Sicredi")) {
        throw new SicrediClientError({
          operation,
          message: "Invalid Sicredi authentication response",
          code: "INVALID_RESPONSE",
        });
      }
      throw this.toClientError(error, {
        operation,
        method: "POST",
        path: this.config.authUrl,
        safeToRetry: false,
      });
    }
  }

  private async fetchForm(
    operation: "authenticate" | "refreshToken",
    body: Record<string, string>,
  ): Promise<Response> {
    const requestBody = new URLSearchParams(body);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(this.config.authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "x-api-key": this.config.apiKey,
          context: "COBRANCA",
        },
        body: requestBody,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw await this.toHttpError(response, {
          operation,
          method: "POST",
          path: this.config.authUrl,
          safeToRetry: true,
          uncertainOnFailure: false,
        });
      }
      return response;
    } catch (error) {
      throw this.toClientError(error, {
        operation,
        method: "POST",
        path: this.config.authUrl,
        safeToRetry: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private beneficiaryHeaders() {
    return {
      cooperativa: this.config.cooperativa,
      posto: this.config.posto,
    };
  }

  private buildUrl(path: string, query?: RequestOptions["query"]) {
    const url = new URL(path, `${this.config.baseUrl}/`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private async toHttpError(response: Response, options: RequestOptions) {
    const safe = await this.safeErrorMessage(response);
    return new SicrediClientError({
      operation: options.operation,
      message: safe.message,
      statusCode: response.status,
      code: safe.code,
      transient: isTransientStatus(response.status),
      uncertain: Boolean(options.uncertainOnFailure && isUncertainStatus(response.status)),
    });
  }

  private async safeErrorMessage(response: Response) {
    const fallback = `Sicredi request failed with HTTP ${response.status}`;
    let text = "";
    try {
      text = (await response.text()).slice(0, 1000);
    } catch {
      return { message: fallback };
    }
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const message =
        readOptionalString(parsed, "mensagem") ??
        readOptionalString(parsed, "message") ??
        readOptionalString(parsed, "erro") ??
        readOptionalString(parsed, "error") ??
        fallback;
      const code =
        readOptionalString(parsed, "codigo") ??
        readOptionalString(parsed, "code") ??
        readOptionalString(parsed, "status");
      return { message: this.redact(message), code: code ? this.redact(code) : undefined };
    } catch {
      return { message: this.redact(text || fallback) };
    }
  }

  private toNetworkError(error: unknown, options: RequestOptions) {
    const isAbort =
      error instanceof Error && (error.name === "AbortError" || error.message.includes("aborted"));
    return new SicrediClientError({
      operation: options.operation,
      message: isAbort ? "Sicredi request timed out" : "Sicredi network request failed",
      code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      transient: true,
      uncertain: Boolean(options.uncertainOnFailure),
    });
  }

  private toClientError(error: unknown, options: RequestOptions) {
    if (error instanceof SicrediClientError) {
      return error;
    }
    return this.toNetworkError(error, options);
  }

  private shouldRetry(error: SicrediClientError, options: RequestOptions, attempt: number) {
    return Boolean(options.safeToRetry && error.transient && attempt < this.resolveMaxAttempts(options));
  }

  private resolveMaxAttempts(options: RequestOptions) {
    return options.safeToRetry ? this.maxAttempts : 1;
  }

  private async waitBeforeRetry(response: Response | undefined, attempt: number) {
    const retryAfter = response?.headers.get("retry-after");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
    const backoffMs = retryAfterMs > 0 ? retryAfterMs : 100 * attempt + Math.floor(Math.random() * 25);
    await this.sleep(backoffMs);
  }

  private redact(value: string) {
    let output = value;
    for (const secret of [
      this.config.apiKey,
      this.config.username,
      this.config.password,
      this.token?.accessToken,
      this.token?.refreshToken,
    ]) {
      if (secret) {
        output = output.split(secret).join("[redacted]");
      }
    }
    return output;
  }

  private toPaidBankSlip(input: unknown): SicrediPaidBankSlip {
    const item = assertRecord(input, "paid bank slip item");
    return {
      nossoNumero: readString(item, "nossoNumero"),
      seuNumero: readString(item, "seuNumero"),
      dataPagamento: readString(item, "dataPagamento"),
      valor: readDecimalString(item, "valor"),
      valorLiquidado: readDecimalString(item, "valorLiquidado"),
      jurosLiquido: readOptionalDecimalString(item, "jurosLiquido"),
      descontoLiquido: readOptionalDecimalString(item, "descontoLiquido"),
      multaLiquida: readOptionalDecimalString(item, "multaLiquida"),
      abatimentoLiquido: readOptionalDecimalString(item, "abatimentoLiquido"),
      tipoLiquidacao: readOptionalString(item, "tipoLiquidacao"),
    };
  }
}

function isTransientStatus(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isUncertainStatus(status: number) {
  return status >= 500 || status === 408 || status === 429;
}

function assertRecord(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new SicrediClientError({
      operation: "getBankSlip",
      message: `Invalid Sicredi ${label} response`,
      code: "INVALID_RESPONSE",
    });
  }
  return input as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string, fallbackKey?: string): string {
  const value = record[key] ?? (fallbackKey ? record[fallbackKey] : undefined);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing Sicredi field: ${key}`);
  }
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readPositiveNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Missing Sicredi numeric field: ${key}`);
  }
  return parsed;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return false;
}

function readDecimalString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(`Missing Sicredi decimal field: ${key}`);
}

function readOptionalDecimalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null) {
    return undefined;
  }
  return readDecimalString(record, key);
}

function readLiquidation(input: unknown): SicrediBankSlipDetails["dadosLiquidacao"] {
  if (input === undefined || input === null) {
    return undefined;
  }
  const record = assertRecord(input, "liquidation");
  return {
    data: readOptionalString(record, "data"),
    valor: readOptionalDecimalString(record, "valor"),
    multa: readOptionalDecimalString(record, "multa"),
    abatimento: readOptionalDecimalString(record, "abatimento"),
    juros: readOptionalDecimalString(record, "juros"),
    desconto: readOptionalDecimalString(record, "desconto"),
  };
}

function sanitizeFileToken(value: string) {
  return value.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 60) || "sicredi";
}
