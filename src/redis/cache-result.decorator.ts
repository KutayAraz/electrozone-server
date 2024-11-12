import { Inject } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface CacheOptions {
    prefix: string;
    ttl?: number;
    paramKeys?: string[];
}

/**
 * Decorator factory that creates a caching decorator for methods
 */
export function CacheResult(options: CacheOptions) {
    const injectRedisService = Inject(RedisService)

    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        injectRedisService(target, "redisService")
        // Get the original method
        const originalMethod = descriptor.value;

        // Create new method descriptor
        descriptor.value = async function (...args: any[]) {
            // Get RedisService instance
            const redis: RedisService = (this as any).redisService;

            // Build cache key parameters
            const params: Record<string, any> = {};

            if (options.paramKeys) {
                // If specific parameter keys are provided, use them
                options.paramKeys.forEach((key, index) => {
                    if (index < args.length) {
                        params[key] = args[index];
                    }
                });
            } else {
                // If no specific keys are provided, use argument indices as keys
                args.forEach((arg, index) => {
                    // Only include serializable parameters
                    if (
                        typeof arg !== 'function' &&
                        typeof arg !== 'undefined' &&
                        arg !== null
                    ) {
                        params[`param${index}`] = arg;
                    }
                });
            }

            // Generate cache key
            const cacheKey = redis.generateKey(options.prefix, params);

            try {
                // Try to get from cache first
                const cachedResult = await redis.get(cacheKey);
                if (cachedResult !== null) {
                    return cachedResult;
                }

                // If not in cache, execute the original method
                const result = await originalMethod.apply(this, args);

                // Cache the result
                if (result !== undefined && result !== null) {
                    await redis.set(cacheKey, result, options.ttl);
                }

                return result;
            } catch (error) {
                // If there's any error with caching, fall back to the original method
                console.error('Cache error:', error);
                return originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}