import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";
import { entities } from "src/entities";

export default (config: ConfigService): TypeOrmModuleOptions => {
  const isProduction = config.get<string>("NODE_ENV") === "production";

  return {
    type: "mysql",
    host: config.get<string>("DB_HOST"),
    port: config.get<number>("DB_PORT"),
    username: config.get<string>("DB_USERNAME"),
    password: config.get<string>("DB_PASSWORD"),
    database: config.get<string>("DB_NAME"),
    entities,
    migrations: [join(__dirname, "..", "migrations", "*{.ts,.js}")],
    // Development relies on schema sync for fast iteration; production is
    // driven entirely by the committed migrations.
    synchronize: !isProduction,
    migrationsRun: isProduction,
    ssl: isProduction
      ? {
          require: true,
          rejectUnauthorized: true, // Ensure certificate validity in production
        }
      : undefined,
  };
};
