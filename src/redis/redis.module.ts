import { Global, Module } from "@nestjs/common";
import { RedisModule as NestRedisModule, RedisModuleOptions } from "@liaoliaots/nestjs-redis";
import { RedisService } from "./redis.service";
import { ConfigModule, ConfigService } from "@nestjs/config";

@Global()
@Module({
  imports: [
    ConfigModule.forRoot(),
    NestRedisModule.forRootAsync({
      imports: [ConfigModule],
      // The library declares useFactory as (...args: unknown[]), so the
      // injected dependency is narrowed here rather than in the signature.
      useFactory: (...args: unknown[]): RedisModuleOptions => {
        const [configService] = args as [ConfigService];

        // Managed providers (Upstash and friends) hand out a single connection
        // URL. A rediss:// scheme enables TLS in ioredis on its own, so no
        // extra configuration is needed. Fall back to host/port for local dev.
        const url = configService.get<string>("REDIS_URL");

        if (url) {
          return { config: { url } };
        }

        return {
          config: {
            host: configService.get<string>("REDIS_HOST"),
            port: configService.get<number>("REDIS_PORT"),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
