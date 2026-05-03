import { createClient, RedisClientType } from 'redis';
import type { RepairGuide } from './types';

const TRANSCRIPT_TTL = 86_400;       // 24h — transcripts are cheap to refetch
const GUIDE_TTL = 7 * 86_400;        // 7d — guides are expensive to regenerate

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

// ---------------------------------------------------------------------------
// Generic primitives
// ---------------------------------------------------------------------------
async function getCached(key: string): Promise<string | null> {
  const now = Date.now();

  const cached = memoryCache.get(key);
  if (cached && cached.expiry > now) {
    return cached.value;
  }

  if (isRedisAvailable && redisClient) {
    try {
      const result = await redisClient.get(key);
      if (result) {
        // Refresh memory cache on Redis hit
        memoryCache.set(key, { value: result, expiry: now + 60_000 });
        return result;
      }
    } catch (err) {
      console.warn('Redis get error:', err);
    }
  }

  return null;
}

async function setCached(key: string, value: string, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  memoryCache.set(key, { value, expiry: now + ttlSeconds * 1000 });

  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, value);
    } catch (err) {
      console.warn('Redis set error:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Transcript cache
// ---------------------------------------------------------------------------
export async function getCachedTranscript(videoId: string): Promise<string | null> {
  const result = await getCached(`transcript:${videoId}`);
  if (result) console.log(`✓ Transcript cache hit: ${videoId}`);
  return result;
}

export async function cacheTranscript(videoId: string, transcript: string): Promise<void> {
  await setCached(`transcript:${videoId}`, transcript, TRANSCRIPT_TTL);
}

// ---------------------------------------------------------------------------
// Guide cache
// ---------------------------------------------------------------------------
export interface CachedGuide {
  guide: RepairGuide;
  framesAnalyzed: number;
  researchPerformed: boolean;
  commentsAnalyzed: number;
  provider: string;
  model: string;
  cachedAt: number;
  frames?: string[];   // base64 JPEGs — included so shared views can render frame-grounded steps
}

function guideKey(videoId: string, provider: string, model: string): string {
  const safeModel = model.replace(/[:/]/g, '_');
  return `guide:${videoId}:${provider}:${safeModel}`;
}

export async function getCachedGuide(
  videoId: string,
  provider: string,
  model: string
): Promise<CachedGuide | null> {
  const raw = await getCached(guideKey(videoId, provider, model));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedGuide;
    console.log(`✓ Guide cache hit: ${videoId} (${provider}/${model})`);
    return parsed;
  } catch (err) {
    console.warn('Failed to parse cached guide:', err);
    return null;
  }
}

export async function cacheGuide(
  videoId: string,
  provider: string,
  model: string,
  payload: Omit<CachedGuide, 'cachedAt'>
): Promise<void> {
  const value: CachedGuide = { ...payload, cachedAt: Date.now() };
  const serialized = JSON.stringify(value);

  // Safety check — Redis itself can handle this, but we don't want a runaway
  // payload silently consuming resources. 8 frames @ 640px JPEG q4 should be
  // well under 1MB; anything larger likely indicates a bug.
  const sizeMB = serialized.length / (1024 * 1024);
  if (sizeMB > 5) {
    console.warn(`Skipping cache write for ${videoId} — payload too large (${sizeMB.toFixed(1)}MB)`);
    return;
  }

  await setCached(guideKey(videoId, provider, model), serialized, GUIDE_TTL);
  console.log(`✓ Guide cached: ${videoId} (${provider}/${model}, ${sizeMB.toFixed(2)}MB)`);
}

export async function deleteCachedGuide(
  videoId: string,
  provider: string,
  model: string
): Promise<void> {
  const key = guideKey(videoId, provider, model);
  memoryCache.delete(key);
  if (isRedisAvailable && redisClient) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.warn('Redis delete error:', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
export async function initCache() {
  await initRedis();
}

initCache().catch(console.error);
