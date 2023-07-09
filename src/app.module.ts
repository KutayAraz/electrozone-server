import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UsersModule } from "./users/users.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./entities/User.entity";
import { CategoriesModule } from "./categories/categories.module";
import { Category } from "./entities/Category.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: "localhost",
      port: 3306,
      entities: [User, Category],
      synchronize: true,
    }),
    UsersModule,
    CategoriesModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
