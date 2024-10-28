import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
    private readonly logger = new Logger(RedisService.name);

    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) { }

    async get<T>(key: string): Promise<T | null> {
        try {
            const cachedValue = await this.cacheManager.get<string>(key);
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
            await this.cacheManager.set(key, serializedValue, ttl);
            return true;
        } catch (error) {
            this.logger.error(`Error setting cache key ${key}:`, error);
            return false;
        }
    }

    async del(key: string): Promise<boolean> {
        try {
            await this.cacheManager.del(key);
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
            this.logger.error('Error retrieving multiple keys:', error);
            return keys.map(() => null);
        }
    }

    async mset(entries: { key: string; value: any; ttl?: number }[]): Promise<boolean[]> {
        try {
            const results = await Promise.all(
                entries.map(({ key, value, ttl }) => this.set(key, value, ttl))
            );
            return results;
        } catch (error) {
            this.logger.error('Error setting multiple keys:', error);
            return entries.map(() => false);
        }
    }

    generateKey(prefix: string, params: Record<string, any>): string {
        // Ensure params are sorted for consistent key generation
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {} as Record<string, any>);

        return `${prefix}:${JSON.stringify(sortedParams)}`;
    }

    /**
     * Helper method to ensure keys follow a consistent pattern
     */
    static sanitizeKey(key: string): string {
        return key.replace(/\s+/g, ':').toLowerCase();
    }
}