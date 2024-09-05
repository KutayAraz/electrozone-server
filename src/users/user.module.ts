import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtModule } from "@nestjs/jwt";
import { AtStrategy, RtStrategy } from "./strategies";
import { Wishlist } from "src/entities/Wishlist.entity";
import { Cart } from "src/entities/Cart.entity";
import { AuthUtilityService } from "./services/auth-utility.service";
import { UserController } from "./controllers/user.controller";
import { UserService } from "./services/user.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Wishlist, Cart]),
    JwtModule.register({}),
  ],
  controllers: [UserController, AuthController],
  providers: [UserService, AuthService, AuthUtilityService, AtStrategy, RtStrategy],
})
export class UserModule {}
