import { Injectable, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisStore } from "connect-redis";
import { NextFunction, Request, Response } from "express";
import session = require("express-session");
import { baseCookieOptions } from "src/config/cookie.config";
import { RedisService } from "src/redis/redis.service";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private sessionMiddleware: ReturnType<typeof session>;

  constructor(
    private readonly redisService: RedisService,
    private readonly config: ConfigService,
  ) {
    this.sessionMiddleware = session({
      // Sessions live in Redis rather than the default in-memory store, which
      // loses every cart whenever the process restarts and cannot be shared
      // across instances.
      store: new RedisStore({
        client: this.redisService.getClient(),
        prefix: "sess:",
        ttl: SESSION_TTL_MS / 1000, // seconds
      }),
      secret: this.config.get<string>("SESSION_SECRET"),
      resave: false,
      saveUninitialized: true,
      rolling: true,
      cookie: {
        ...baseCookieOptions(),
        maxAge: SESSION_TTL_MS,
      },
      name: "sessionId",
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    return this.sessionMiddleware(req, res, next);
  }
}
