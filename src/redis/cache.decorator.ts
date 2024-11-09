import { RedisService } from './redis.service';
import { SetMetadata, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
export const CACHE_TTL_KEY = 'cache_ttl';
export const CacheTTL = (ttl: number) => SetMetadata(CACHE_TTL_KEY, ttl);

export function Cache() {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Get the ModuleRef from the class instance
            const moduleRef = (this as any).moduleRef;
            if (!moduleRef) {
                throw new Error('ModuleRef must be injected in the class');
            }

            // Get the RedisCacheService instance
            const cacheService = moduleRef.get(RedisService, { strict: false });

            const className = this.constructor.name;
            const cacheKey = cacheService.createKey(className, propertyKey, args);

            // Get TTL from decorator metadata if exists
            const ttl = Reflect.getMetadata(CACHE_TTL_KEY, target, propertyKey);

            try {
                // Try to get from cache first
                const cachedValue = await cacheService.get(cacheKey);
                if (cachedValue !== null) {
                    return cachedValue;
                }

                // If not in cache, execute the original method
                const result = await originalMethod.apply(this, args);

                // Store in cache with TTL if provided
                await cacheService.set(cacheKey, result, ttl);

                return result;
            } catch (error) {
                // If there's any cache error, fallback to original method
                console.error('Cache error:', error);
                return originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}
