import { Logger } from '@nestjs/common';

interface CacheOptions {
    prefix: string;
    ttl?: number;
    paramKeys?: string[];
}

export function CacheResult(options: CacheOptions) {
    const logger = new Logger('CacheDecorator');

    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const redisService = this.redisService;
            if (!redisService) {
                logger.warn(`Redis service not found in ${target.constructor.name}, skipping cache`);
                return originalMethod.apply(this, args);
            }

            // Build cache parameters from method arguments
            const params: Record<string, any> = {};
            if (options.paramKeys) {
                options.paramKeys.forEach((key, index) => {
                    if (args[index] !== undefined) {
                        params[key] = args[index];
                    }
                });
            } else if (args.length === 1 && typeof args[0] === 'object') {
                // If single object argument, use it directly
                Object.assign(params, args[0]);
            }

            const cacheKey = redisService.generateKey(options.prefix, params);

            try {
                // Try to get from cache
                const cachedValue = await redisService.get(cacheKey);
                if (cachedValue !== null) {
                    logger.debug(`Cache hit for key: ${cacheKey}`);
                    return cachedValue;
                }

                // Execute original method if cache miss
                logger.debug(`Cache miss for key: ${cacheKey}`);
                const result = await originalMethod.apply(this, args);

                // Store in cache
                await redisService.set(cacheKey, result, options.ttl);

                return result;
            } catch (error) {
                logger.error(`Cache error for key ${cacheKey}:`, error);
                // Fallback to original method on cache error
                return originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}