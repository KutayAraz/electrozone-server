import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisService } from './redis.service';
import type { RedisClientOptions } from 'redis';

@Global() // Makes the module available everywhere without importing
@Module({
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
                    ttl: 3600,
                };
            },
        }),
    ],
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule { }