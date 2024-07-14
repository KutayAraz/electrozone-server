import { Module } from "@nestjs/common";
import { UsersController } from "./controllers/users.controller";
import { UsersService } from "./services/users.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/entities/User.entity";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { JwtModule } from "@nestjs/jwt";
import { AtStrategy, RtStrategy } from "./strategies";
import { Wishlist } from "src/entities/Wishlist.entity";
import { Cart } from "src/entities/Cart.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Wishlist, Cart]),
    JwtModule.register({}),
  ],
  controllers: [UsersController, AuthController],
  providers: [UsersService, AuthService, AtStrategy, RtStrategy],
})
export class UsersModule {}
