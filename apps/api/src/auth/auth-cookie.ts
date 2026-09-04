import type { CookieOptions } from "express";
import type { AppEnv } from "../config/env.js";

const AUTH_COOKIE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function authCookieOptions(nodeEnv: AppEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function clearAuthCookieOptions(nodeEnv: AppEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: nodeEnv === "production",
    path: "/",
  };
}
