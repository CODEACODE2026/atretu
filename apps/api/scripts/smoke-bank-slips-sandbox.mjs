const required = [
  "SICREDI_AUTH_URL",
  "SICREDI_BASE_URL",
  "SICREDI_API_KEY",
  "SICREDI_USERNAME",
  "SICREDI_PASSWORD",
  "SICREDI_COOPERATIVA",
  "SICREDI_POSTO",
  "SICREDI_CODIGO_BENEFICIARIO",
];

if (process.env.RUN_SICREDI_SANDBOX_SMOKE !== "true") {
  throw new Error(
    "Sandbox smoke blocked: set RUN_SICREDI_SANDBOX_SMOKE=true only after explicit approval",
  );
}

if (process.env.SICREDI_ENV !== "sandbox") {
  throw new Error("Sandbox smoke blocked: SICREDI_ENV must be sandbox");
}

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length > 0) {
  throw new Error(`Sandbox smoke blocked: missing ${missing.join(", ")}`);
}

throw new Error(
  "Sandbox smoke checklist passed, but real Sicredi calls are intentionally not automated in Sprint 11. Use the approved homologation runbook before adding live calls.",
);
