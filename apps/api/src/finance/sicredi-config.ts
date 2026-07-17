export type SicrediEnvironment = "sandbox" | "production";

export type SicrediConfig = {
  environment: SicrediEnvironment;
  authUrl: string;
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  cooperativa: string;
  posto: string;
  codigoBeneficiario: string;
  timeoutMs: number;
  requirePayerAddress: boolean;
  syncOpenIssuedIntervalMs: number;
  syncOpenIssuedLimit: number;
  issueBatchIntervalMs: number;
  issueBatchConcurrency: number;
  issueBatchLimit: number;
};

export function loadSicrediConfig(env: NodeJS.ProcessEnv = process.env): SicrediConfig {
  const environment = readEnvironment(env.SICREDI_ENV);
  return {
    environment,
    authUrl: readUrl("SICREDI_AUTH_URL", env.SICREDI_AUTH_URL),
    baseUrl: readUrl("SICREDI_BASE_URL", env.SICREDI_BASE_URL),
    apiKey: readRequired("SICREDI_API_KEY", env.SICREDI_API_KEY),
    username: readRequired("SICREDI_USERNAME", env.SICREDI_USERNAME),
    password: readRequired("SICREDI_PASSWORD", env.SICREDI_PASSWORD),
    cooperativa: readDigits("SICREDI_COOPERATIVA", env.SICREDI_COOPERATIVA, 4),
    posto: readDigits("SICREDI_POSTO", env.SICREDI_POSTO, 2),
    codigoBeneficiario: readDigits(
      "SICREDI_CODIGO_BENEFICIARIO",
      env.SICREDI_CODIGO_BENEFICIARIO,
      5,
    ),
    timeoutMs: readPositiveInt("SICREDI_HTTP_TIMEOUT_MS", env.SICREDI_HTTP_TIMEOUT_MS, 10_000),
    requirePayerAddress: readBoolean(
      "SICREDI_REQUIRE_PAYER_ADDRESS",
      env.SICREDI_REQUIRE_PAYER_ADDRESS,
      false,
    ),
    syncOpenIssuedIntervalMs: readPositiveInt(
      "SICREDI_SYNC_OPEN_ISSUED_INTERVAL_MS",
      env.SICREDI_SYNC_OPEN_ISSUED_INTERVAL_MS,
      15 * 60 * 1000,
    ),
    syncOpenIssuedLimit: readPositiveInt(
      "SICREDI_SYNC_OPEN_ISSUED_LIMIT",
      env.SICREDI_SYNC_OPEN_ISSUED_LIMIT,
      50,
    ),
    issueBatchIntervalMs: readPositiveInt(
      "SICREDI_ISSUE_BATCH_INTERVAL_MS",
      env.SICREDI_ISSUE_BATCH_INTERVAL_MS,
      60_000,
    ),
    issueBatchConcurrency: readBoundedPositiveInt(
      "SICREDI_ISSUE_BATCH_CONCURRENCY",
      env.SICREDI_ISSUE_BATCH_CONCURRENCY,
      2,
      3,
    ),
    issueBatchLimit: readPositiveInt(
      "SICREDI_ISSUE_BATCH_LIMIT",
      env.SICREDI_ISSUE_BATCH_LIMIT,
      20,
    ),
  };
}

function readEnvironment(value: string | undefined): SicrediEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sandbox" || normalized === "production") {
    return normalized;
  }
  throw new Error("SICREDI_ENV must be sandbox or production");
}

function readRequired(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required Sicredi environment variable: ${name}`);
  }
  return trimmed;
}

function readUrl(name: string, value: string | undefined) {
  const trimmed = readRequired(name, value);
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid Sicredi URL environment variable: ${name}`);
  }
}

function readDigits(name: string, value: string | undefined, length: number) {
  const trimmed = readRequired(name, value);
  if (!new RegExp(`^\\d{${length}}$`).test(trimmed)) {
    throw new Error(`${name} must contain exactly ${length} digits`);
  }
  return trimmed;
}

function readPositiveInt(name: string, value: string | undefined, fallback: number) {
  const raw = value?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function readBoundedPositiveInt(
  name: string,
  value: string | undefined,
  fallback: number,
  max: number,
) {
  const parsed = readPositiveInt(name, value, fallback);
  if (parsed > max) {
    throw new Error(`${name} must be less than or equal to ${max}`);
  }
  return parsed;
}

function readBoolean(name: string, value: string | undefined, fallback: boolean) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  throw new Error(`${name} must be true or false`);
}
