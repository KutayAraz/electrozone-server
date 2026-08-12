import { config as loadEnv } from "dotenv";
import { join } from "path";
import { DataSource } from "typeorm";
import { entities } from "../entities";

/**
 * Standalone DataSource used only by the TypeORM CLI (migration:generate,
 * migration:run, migration:revert). The running application builds its own
 * options from ConfigService in database.config.ts.
 *
 * Loads .env.<NODE_ENV> the same way AppModule does, defaulting to
 * development. Individual DB_* variables can be overridden from the shell,
 * which is how migrations are generated against a scratch database.
 */
const nodeEnv = process.env.NODE_ENV ?? "development";
loadEnv({ path: `.env.${nodeEnv}` });

const isProduction = nodeEnv === "production";

export default new DataSource({
  type: "mysql",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities,
  migrations: [join(__dirname, "..", "migrations", "*{.ts,.js}")],
  // Never let the CLI mutate the schema implicitly.
  synchronize: false,
  ssl: isProduction ? { require: true, rejectUnauthorized: true } : undefined,
});
