import { Module, MiddlewareConsumer } from "@nestjs/common";
import { UsersController } from "./controllers/users.controller";
import { UsersService } from "./services/users.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { LocalStrategy } from "./strategies/local.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { RefreshJwtStrategy } from "./strategies/refrestToken.strategy";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.AUTH_SECRET,
        signOptions: {
          expiresIn: "2m",
        },
      }),
    }),
  ],
  controllers: [UsersController, AuthController],
  providers: [
    UsersService,
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RefreshJwtStrategy,
  ],
})
export class UsersModule {}
