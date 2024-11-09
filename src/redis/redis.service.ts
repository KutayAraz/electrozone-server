import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    constructor(
        @Inject('REDIS_CLIENT')
        private readonly redis: Redis,
    ) { }

    async get<T>(key: string): Promise<T | null> {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : null;
    }

    async set(key: string, value: any, ttl?: number): Promise<void> {
        const serializedValue = JSON.stringify(value);
        if (ttl) {
            await this.redis.setex(key, ttl, serializedValue);
        } else {
            await this.redis.set(key, serializedValue);
        }
    }

    async del(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async invalidateByPattern(pattern: string): Promise<void> {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
            await this.redis.del(...keys);
        }
    }

    // Helper method to create cache key based on class name, method name and parameters
    createKey(className: string, methodName: string, args: any[]): string {
        return `${className}:${methodName}:${JSON.stringify(args)}`;
    }

    // Helper method to create product-related pattern for invalidation
    createProductPattern(productId: number): string {
        return `*:*:*${productId}*`;
    }
}