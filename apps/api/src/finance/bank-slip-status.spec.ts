import assert from "node:assert/strict";
import { BankSlipStatus } from "@prisma/client";
import {
  mapSicrediStatusToBankSlipStatus,
  normalizeProviderStatus,
} from "./bank-slip-status.js";

assert.equal(normalizeProviderStatus(" liquidado   compe "), "LIQUIDADO COMPE");
assert.equal(
  mapSicrediStatusToBankSlipStatus("LIQUIDADO"),
  BankSlipStatus.PAID,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("LIQUIDADO PIX"),
  BankSlipStatus.PAID,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("BAIXADO POR SOLICITACAO"),
  BankSlipStatus.CANCELLED,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("EM CARTEIRA"),
  BankSlipStatus.ISSUED,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("VENCIDO"),
  BankSlipStatus.ISSUED,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("REJEITADO"),
  BankSlipStatus.ISSUE_FAILED,
);
assert.equal(
  mapSicrediStatusToBankSlipStatus("EM CARTORIO"),
  BankSlipStatus.UNKNOWN,
);
