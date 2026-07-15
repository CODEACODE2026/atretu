import { ForbiddenException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createOriginCheckMiddleware(allowedOrigins: string[]) {
  const allowlist = new Set(allowedOrigins);
  return (request: Request, _response: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const origin = headerValue(request.headers.origin);
    if (origin) {
      assertAllowedOrigin(origin, allowlist);
      next();
      return;
    }

    const refererOrigin = originFromReferer(headerValue(request.headers.referer));
    if (refererOrigin) {
      assertAllowedOrigin(refererOrigin, allowlist);
      next();
      return;
    }

    if (looksLikeBrowserRequest(request)) {
      throw new ForbiddenException("Origem da requisicao nao permitida");
    }

    next();
  };
}

function assertAllowedOrigin(origin: string, allowlist: Set<string>) {
  if (!allowlist.has(origin)) {
    throw new ForbiddenException("Origem da requisicao nao permitida");
  }
}

function originFromReferer(referer: string | undefined) {
  if (!referer) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    throw new ForbiddenException("Origem da requisicao nao permitida");
  }
}

function looksLikeBrowserRequest(request: Request) {
  const secFetchSite = headerValue(request.headers["sec-fetch-site"]);
  if (secFetchSite) {
    return true;
  }
  const userAgent = headerValue(request.headers["user-agent"])?.toLowerCase() ?? "";
  return /\b(mozilla|chrome|safari|firefox|edg|opr)\b/.test(userAgent);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
