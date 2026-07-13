import { BadRequestException } from "@nestjs/common";

type PaginationInput = {
  page?: unknown;
  limit?: unknown;
};

type PaginationOptions = {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
};

export function resolvePagination(
  input: PaginationInput,
  options: PaginationOptions = {},
) {
  const defaultPage = options.defaultPage ?? 1;
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;
  const page = readPositiveInt(input.page, "page", defaultPage);
  const limit = readPositiveInt(input.limit, "limit", defaultLimit);
  if (limit > maxLimit) {
    throw new BadRequestException({
      code: "INVALID_PAGINATION",
      message: `limit deve ser menor ou igual a ${maxLimit}`,
    });
  }
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function readPositiveInt(value: unknown, field: "page" | "limit", fallback: number) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException({
      code: "INVALID_PAGINATION",
      message: `${field} deve ser um inteiro positivo`,
    });
  }
  return parsed;
}
