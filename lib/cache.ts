import { createClient, RedisClientType } from 'redis';

const CACHE_TTL = 86400;

let redisClient: RedisClientType | null = null;
let isRedisAvailable = false;

async function initRedis() {
  if (isRedisAvailable || !process.env.REDIS_URL) return;
  
  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    isRedisAvailable = true;
    console.log('✓ Redis cache connected');
  } catch (err) {
    console.warn('⚠ Redis unavailable, using in-memory cache:', err instanceof Error ? err.message : '');
    isRedisAvailable = false;
  }
}

const memoryCache = new Map<string, { value: string; expiry: number }>();

export async function getCachedTranscript(videoId: string): Promise<string | null> {
  const key = `transcript:${videoId}`;
  const now = Date.now();

  const cached = memoryCache.get(key);
  if (cached && cached.expiry > now) {
    console.log(`✓ Cache hit (memory): ${videoId}`);
    return cached.value;
  }

  if (isRedisAvailable && redisClient) {
    try {
      const result = await redisClient.get(key);
      if (result) {
        console.log(`✓ Cache hit (Redis): ${videoId}`);
        memoryCache.set(key, { value: result, expiry: now + CACHE_TTL * 1000 });
        return result;
      }
    } catch (err) {
      console.warn('Redis get error:', err);
    }
  }

  return null;
}

export async function cacheTranscript(videoId: string, transcript: string): Promise<void> {
  const key = `transcript:${videoId}`;
  const now = Date.now();

  memoryCache.set(key, { value: transcript, expiry: now + CACHE_TTL * 1000 });

  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, CACHE_TTL, transcript);
      console.log(`✓ Cached to Redis: ${videoId}`);
    } catch (err) {
      console.warn('Redis set error:', err);
    }
  }
}

export async function initCache() {
  await initRedis();
}

initCache().catch(console.error);
