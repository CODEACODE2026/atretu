import { type BankSlipStatus } from "../../../lib/api";
import { type BankSlipListRecord } from "./finance-display-utils";

export type BankSlipPrimaryAction = "download" | "error" | "issue" | "none" | "sync";

export function getBankSlipPrimaryAction({
  bankSlip,
  canDownloadPdf,
  canIssue,
}: {
  bankSlip: BankSlipListRecord | null | undefined;
  canDownloadPdf: boolean;
  canIssue: boolean;
}): BankSlipPrimaryAction {
  if (hasBankSlipProviderProblem(bankSlip)) {
    return "error";
  }
  if (canIssue) {
    return "issue";
  }
  if (canDownloadPdf) {
    return "download";
  }
  if (bankSlip) {
    return "sync";
  }
  return "none";
}

export function hasBankSlipProviderProblem(bankSlip: BankSlipListRecord | null | undefined) {
  return Boolean(bankSlip && isProviderProblemStatus(bankSlip.status));
}

function isProviderProblemStatus(status: BankSlipStatus) {
  return status === "CANCELLATION_FAILED" || status === "ISSUE_FAILED" || status === "UNKNOWN";
}
