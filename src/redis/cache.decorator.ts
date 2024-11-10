import { RedisService } from "./redis.service";

export interface CacheOptions {
    ttl?: number;
    keyPrefix?: string;
}

export function Cache(options: CacheOptions = {}) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const redisService: RedisService = this.redisService;
            if (!redisService) {
                console.log("no service")
                return originalMethod.apply(this, args);
            }

            const prefix = options.keyPrefix || this.constructor.name;
            const argsString = args
                .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
                .join(':');
            const cacheKey = `${prefix}:${propertyKey}:${argsString}`;

            try {
                const cachedValue = await redisService.get(cacheKey);
                if (cachedValue !== null) {
                    return cachedValue;
                }

                const result = await originalMethod.apply(this, args);
                await redisService.set(cacheKey, result, options.ttl);
                return result;
            } catch (error) {
                return originalMethod.apply(this, args);
            }
        };

        return descriptor;
    };
}