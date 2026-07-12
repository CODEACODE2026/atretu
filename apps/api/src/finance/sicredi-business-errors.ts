import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type { SicrediClientError, SicrediOperation } from "./sicredi-client.js";

export type SicrediBusinessContext =
  | "issue"
  | "sync"
  | "syncPaidByDay"
  | "cancellation"
  | "pdf";

export type SicrediCancellationOutcome =
  | "ALREADY_PAID"
  | "ALREADY_CANCELLED"
  | "PROCESSING"
  | "NOT_FOUND"
  | "UNCERTAIN"
  | "REJECTED";

export type SicrediBusinessError = {
  operation: SicrediOperation;
  statusCode?: number;
  providerCode?: string;
  message: string;
  code:
    | "SICREDI_AUTHENTICATION_FAILED"
    | "SICREDI_FORBIDDEN"
    | "SICREDI_NOT_FOUND"
    | "SICREDI_CONFLICT"
    | "SICREDI_REQUEST_REJECTED"
    | "SICREDI_TEMPORARILY_UNAVAILABLE"
    | "SICREDI_INVALID_RESPONSE";
  transient: boolean;
  uncertain: boolean;
  cancellationOutcome?: SicrediCancellationOutcome;
};

export function translateSicrediClientError(
  error: SicrediClientError,
  context: SicrediBusinessContext,
): SicrediBusinessError {
  const providerCode = safeToken(error.code);
  const normalized = normalize(`${error.code ?? ""} ${error.message}`);
  const statusCode = error.statusCode;
  const cancellationOutcome =
    context === "cancellation"
      ? classifyCancellationOutcome(statusCode, providerCode, normalized, error)
      : undefined;

  if (error.code === "INVALID_JSON" || error.code === "INVALID_RESPONSE") {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_INVALID_RESPONSE",
      message: "Sicredi retornou uma resposta invalida",
      transient: false,
      uncertain: error.uncertain,
      cancellationOutcome,
    };
  }

  if (error.uncertain || error.transient || statusCode === 429 || isServerError(statusCode)) {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_TEMPORARILY_UNAVAILABLE",
      message: temporaryMessage(context),
      transient: true,
      uncertain: error.uncertain || isServerError(statusCode) || statusCode === 429,
      cancellationOutcome,
    };
  }

  if (statusCode === 401) {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_AUTHENTICATION_FAILED",
      message: "Falha de autenticacao com o Sicredi",
      transient: false,
      uncertain: false,
      cancellationOutcome,
    };
  }

  if (statusCode === 403) {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_FORBIDDEN",
      message: "Operacao nao autorizada pelo Sicredi para este convenio",
      transient: false,
      uncertain: false,
      cancellationOutcome,
    };
  }

  if (statusCode === 404 || cancellationOutcome === "NOT_FOUND") {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_NOT_FOUND",
      message: "Boleto nao encontrado no Sicredi",
      transient: false,
      uncertain: false,
      cancellationOutcome: cancellationOutcome ?? "NOT_FOUND",
    };
  }

  if (statusCode === 409 || cancellationOutcome === "ALREADY_PAID" || cancellationOutcome === "ALREADY_CANCELLED" || cancellationOutcome === "PROCESSING") {
    return {
      operation: error.operation,
      statusCode,
      providerCode,
      code: "SICREDI_CONFLICT",
      message: "Sicredi retornou conflito para a operacao solicitada",
      transient: false,
      uncertain: cancellationOutcome === "PROCESSING",
      cancellationOutcome,
    };
  }

  return {
    operation: error.operation,
    statusCode,
    providerCode,
    code: "SICREDI_REQUEST_REJECTED",
    message: rejectedMessage(context),
    transient: false,
    uncertain: false,
    cancellationOutcome: cancellationOutcome ?? "REJECTED",
  };
}

export function toSicrediHttpException(error: SicrediBusinessError) {
  const body = {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    providerCode: error.providerCode,
    transient: error.transient,
    uncertain: error.uncertain,
  };
  switch (error.code) {
    case "SICREDI_AUTHENTICATION_FAILED":
      return new UnauthorizedException(body);
    case "SICREDI_FORBIDDEN":
      return new ForbiddenException(body);
    case "SICREDI_NOT_FOUND":
      return new NotFoundException(body);
    case "SICREDI_CONFLICT":
      return new ConflictException(body);
    case "SICREDI_TEMPORARILY_UNAVAILABLE":
      return new ServiceUnavailableException(body);
    case "SICREDI_INVALID_RESPONSE":
      return new BadGatewayException(body);
    default:
      return new BadRequestException(body);
  }
}

function classifyCancellationOutcome(
  statusCode: number | undefined,
  providerCode: string | undefined,
  normalized: string,
  error: SicrediClientError,
): SicrediCancellationOutcome | undefined {
  const code = normalize(providerCode ?? "");
  if (matches(code, normalized, ["LIQUIDADO", "LIQUIDADA", "PAGO", "PAGA"])) {
    return "ALREADY_PAID";
  }
  if (matches(code, normalized, ["BAIXADO", "BAIXADA", "CANCELADO", "CANCELADA"])) {
    return "ALREADY_CANCELLED";
  }
  if (matches(code, normalized, ["PROCESSAMENTO", "PROCESSANDO", "MOVIMENTO ENVIADO", "EM PROCESSO"])) {
    return "PROCESSING";
  }
  if (statusCode === 404 || matches(code, normalized, ["NAO ENCONTRADO", "NÃO ENCONTRADO", "NOT FOUND"])) {
    return "NOT_FOUND";
  }
  if (error.uncertain || error.transient || statusCode === 429 || isServerError(statusCode)) {
    return "UNCERTAIN";
  }
  return undefined;
}

function matches(code: string, normalized: string, fragments: string[]) {
  return fragments.some((fragment) => code.includes(normalize(fragment)) || normalized.includes(normalize(fragment)));
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function safeToken(value: string | undefined) {
  return value ? value.slice(0, 80) : undefined;
}

function isServerError(statusCode: number | undefined) {
  return statusCode !== undefined && statusCode >= 500;
}

function temporaryMessage(context: SicrediBusinessContext) {
  if (context === "cancellation") {
    return "Pedido de baixa ficou pendente de confirmacao; consulte o Sicredi antes de nova acao";
  }
  if (context === "pdf") {
    return "PDF do boleto esta temporariamente indisponivel";
  }
  return "Sicredi esta temporariamente indisponivel";
}

function rejectedMessage(context: SicrediBusinessContext) {
  if (context === "cancellation") {
    return "Sicredi rejeitou o pedido de baixa do boleto";
  }
  if (context === "issue") {
    return "Sicredi rejeitou a emissao do boleto";
  }
  if (context === "pdf") {
    return "PDF do boleto nao esta disponivel";
  }
  return "Sicredi rejeitou a operacao solicitada";
}
