import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { RedisService as NestRedisService } from "@liaoliaots/nestjs-redis";

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor(private readonly redisService: NestRedisService) {
    this.redis = this.redisService.getOrThrow();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedValue = await this.redis.get(key);
      if (!cachedValue) return null;

      try {
        return JSON.parse(cachedValue) as T;
      } catch (parseError) {
        this.logger.warn(`Failed to parse cached value for key ${key}:`, parseError);
        await this.del(key); // Automatically clean up invalid cache entries
        return null;
      }
    } catch (error) {
      this.logger.error(`Error retrieving cache key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);

      if (ttl !== undefined) {
        // Use EX option for TTL in seconds
        await this.redis.set(key, serializedValue, "EX", ttl);
      } else {
        await this.redis.set(key, serializedValue);
      }

      return true;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}:`, error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await Promise.all(keys.map(key => this.get<T>(key)));
      return values;
    } catch (error) {
      this.logger.error("Error retrieving multiple keys:", error);
      return keys.map(() => null);
    }
  }

  async mset(entries: { key: string; value: any; ttl?: number }[]): Promise<boolean[]> {
    try {
      const results = await Promise.all(
        entries.map(({ key, value, ttl }) => this.set(key, value, ttl)),
      );
      return results;
    } catch (error) {
      this.logger.error("Error setting multiple keys:", error);
      return entries.map(() => false);
    }
  }

  generateKey(prefix: string, params: Record<string, any>): string {
    // Ensure params are sorted for consistent key generation
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = params[key];
          return acc;
        },
        {} as Record<string, any>,
      );

    return `${prefix}:${JSON.stringify(sortedParams)}`;
  }

  async trackProductReference(key: string, value: any, ttl?: number): Promise<void> {
    try {
      // First, store the actual cache entry
      await this.set(key, value, ttl);

      // Then find all product IDs in the value
      const productIds = this.findProductIdsInValue(value);

      if (productIds.size > 0) {
        // For each product found, add this key to its tracking set
        const pipeline = this.redis.pipeline();

        for (const productId of productIds) {
          const trackingKey = `tracking:product:${productId}`;
          pipeline.sadd(trackingKey, key);

          if (ttl) {
            // Ensure tracking key doesn't outlive the cached data
            pipeline.expire(trackingKey, ttl);
          }
        }

        await pipeline.exec();

        this.logger.debug(`Tracked key ${key} for products: ${Array.from(productIds).join(", ")}`);
      }
    } catch (error) {
      this.logger.error(`Failed to track product references for key ${key}:`, error);
    }
  }

  /**
   * Recursively finds all product IDs in a cached value
   */
  private findProductIdsInValue(value: any): Set<number> {
    const productIds = new Set<number>();

    const searchObject = (obj: any) => {
      if (!obj || typeof obj !== "object") return;

      // Check if this object represents a product
      if ("productId" in obj) {
        productIds.add(obj.productId);
      }
      if ("id" in obj && this.isProductObject(obj)) {
        productIds.add(obj.id);
      }

      // Recursively search arrays and objects
      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(item => searchObject(item));
        } else if (typeof value === "object" && value !== null) {
          searchObject(value);
        }
      }
    };

    searchObject(value);
    return productIds;
  }

  /**
   * Heuristic to determine if an object represents a product
   * Customize this based on your data structure
   */
  private isProductObject(obj: any): boolean {
    return "id" in obj && typeof obj.id === "number" && ("price" in obj || "productName" in obj);
  }

  /**
   * Helper method to ensure keys follow a consistent pattern
   */
  static sanitizeKey(key: string): string {
    return key.replace(/\s+/g, ":").toLowerCase();
  }

  async invalidateProductCache(productId: number): Promise<void> {
    try {
      const trackingKey = `tracking:product:${productId}`;
      const keys = await this.redis.smembers(trackingKey);

      if (keys.length > 0) {
        // Delete all affected cache entries
        await this.redis.del(...keys);
        // Clean up the tracking set
        await this.redis.del(trackingKey);

        this.logger.debug(
          `Invalidated ${keys.length} cache entries containing product ${productId}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for product ${productId}:`, error);
    }
  }
}
