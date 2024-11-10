import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { RedisService as NestRedisService } from '@liaoliaots/nestjs-redis';

@Injectable()
export class RedisService {
    private readonly redis: Redis;

    constructor(private readonly redisService: NestRedisService) {
        this.redis = this.redisService.getOrThrow();
    }

    async get(key: string): Promise<any> {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        const serializedValue = JSON.stringify(value);
        if (ttl) {
            await this.redis.set(key, serializedValue, 'EX', ttl);
        } else {
            await this.redis.set(key, serializedValue);
        }
    }

    async del(key: string | string[]): Promise<void> {
        await this.redis.del(Array.isArray(key) ? key : [key]);
    }

    async clearProductCache(productId: number): Promise<void> {
        const pattern = `*:${productId}:*`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }
}