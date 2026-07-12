import { BankSlipStatus } from "@prisma/client";

const PAID_PROVIDER_STATUSES = new Set([
  "LIQUIDADO",
  "LIQUIDADO CARTORIO",
  "LIQUIDADO REDE",
  "LIQUIDADO COMPE",
  "LIQUIDADO PIX",
  "LIQUIDADO CHEQUE",
]);

export function mapSicrediStatusToBankSlipStatus(providerStatus: string) {
  const normalized = normalizeProviderStatus(providerStatus);
  if (PAID_PROVIDER_STATUSES.has(normalized)) {
    return BankSlipStatus.PAID;
  }
  if (normalized === "BAIXADO POR SOLICITACAO") {
    return BankSlipStatus.CANCELLED;
  }
  if (normalized === "EM CARTEIRA" || normalized === "VENCIDO") {
    return BankSlipStatus.ISSUED;
  }
  if (normalized === "REJEITADO") {
    return BankSlipStatus.ISSUE_FAILED;
  }
  return BankSlipStatus.UNKNOWN;
}

export function normalizeProviderStatus(providerStatus: string) {
  return providerStatus.trim().replace(/\s+/g, " ").toUpperCase();
}
