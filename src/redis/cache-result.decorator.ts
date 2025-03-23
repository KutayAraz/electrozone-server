import { Inject } from "@nestjs/common";
import { RedisService } from "./redis.service";

export interface CacheOptions {
  prefix: string;
  ttl?: number;
  paramKeys?: string[];
}

//Decorator factory that creates a caching decorator for methods
export function CacheResult(options: CacheOptions) {
  const injectRedisService = Inject(RedisService);

  return function (target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    injectRedisService(target, "redisService");
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const redis: RedisService = (this as any).redisService;
      const params: Record<string, any> = {};

      // If specific parameter keys are provided, use them
      if (options.paramKeys) {
        options.paramKeys.forEach((key, index) => {
          if (index < args.length) {
            params[key] = args[index];
          }
        });
      }

      const cacheKey = redis.generateKey(options.prefix, params);

      try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult !== null) {
          return cachedResult;
        }

        const result = await originalMethod.apply(this, args);

        if (result !== undefined && result !== null) {
          // Use enhanced tracking when setting cache
          await redis.trackProductReference(cacheKey, result, options.ttl);
        }

        return result;
      } catch (error) {
        console.error("Cache error:", error);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}
