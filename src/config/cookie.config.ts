import { CookieOptions } from "express";

export function baseCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };
}

export const REFRESH_TOKEN_PATH = "/auth";
