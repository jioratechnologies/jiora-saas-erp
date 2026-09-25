import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;

  onModuleInit() {
    const valkeyUrl = process.env.VALKEY_URL || "redis://localhost:6380";
    try {
      this.client = new Redis(valkeyUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

      this.client.connect().then(() => {
        this.logger.log(`Connected to Valkey at ${valkeyUrl}`);
      }).catch((err) => {
        this.logger.warn(`Valkey connection failed (${err.message}). Caching disabled.`);
        this.client = null;
      });

      this.client.on("error", (err) => {
        this.logger.warn(`Valkey error: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Valkey init failed: ${err.message}`);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => {});
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds = 3600): Promise<void> {
    if (!this.client) return;
    try {
      const str = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, str, "EX", ttlSeconds);
      } else {
        await this.client.set(key, str);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to set cache key "${key}": ${err.message}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    try {
      await this.client.del(...keys);
    } catch (err: any) {
      this.logger.warn(`Failed to delete cache keys: ${err.message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    if (!this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to delByPattern "${pattern}": ${err.message}`);
    }
  }
}
