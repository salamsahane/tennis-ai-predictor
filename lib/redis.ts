// lib/redis.ts
// Redis client with in-memory fallback for local development

import { Redis } from '@upstash/redis';

// In-memory store for development fallback
const memoryStore = new Map<string, { value: string; expiry?: number }>();

class InMemoryRedis {
  async get(key: string): Promise<string | null> {
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string | number, options?: { ex?: number }): Promise<void> {
    const expiry = options?.ex ? Date.now() + options.ex * 1000 : undefined;
    memoryStore.set(key, { value: String(value), expiry });
  }

  async del(key: string): Promise<void> {
    memoryStore.delete(key);
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newVal = (current ? parseInt(current) : 0) + 1;
    await this.set(key, newVal);
    return newVal;
  }
}

// Use real Redis if credentials are available, otherwise fallback
function createRedisClient() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    try {
      return new Redis({ url, token });
    } catch {
      console.warn('[Redis] Failed to create Upstash client, using in-memory fallback');
      return new InMemoryRedis();
    }
  }

  console.info('[Redis] No Upstash credentials found, using in-memory fallback');
  return new InMemoryRedis();
}

export const redis = createRedisClient();

// Type guard for checking if we're using real Redis
export function isRealRedis(): boolean {
  return !(redis instanceof InMemoryRedis);
}
