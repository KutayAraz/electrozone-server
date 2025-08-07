import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import * as session from "express-session";

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private sessionMiddleware: ReturnType<typeof session>;

  constructor() {
    this.sessionMiddleware = session({
      secret: "secret",
      resave: false,
      saveUninitialized: true,
      rolling: true,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
      name: "sessionId",
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    return this.sessionMiddleware(req, res, next);
  }
}
