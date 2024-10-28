import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { RedisClientOptions } from 'redis';

export const redisConfig = {
    imports: [
        CacheModule.registerAsync<RedisClientOptions>({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const client = createClient({
                    socket: {
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                    }
                });

                await client.connect();

                return {
                    store: client as any,
                    ttl: 3600, // 1 hour in seconds
                };
            },
        }),
    ],
    exports: [CacheModule],
};