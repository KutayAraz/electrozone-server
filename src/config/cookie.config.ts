import { CookieOptions } from "express";

export function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}

export const REFRESH_TOKEN_PATH = "/api/auth";
