import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { Strategy } from "passport-jwt";
import { JwtPayload } from "src/users/types/jwt-payload.type";

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        return req.cookies?.access_token;
      },
      secretOrKey: config.get<string>("AT_SECRET"),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    return payload;
  }
}
