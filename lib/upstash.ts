import { Redis } from '@upstash/redis';
import CryptoJS from 'crypto-js';

// Initialize Redis client
export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache key prefix
const CACHE_PREFIX = 'essay:';
const CACHE_TTL_SECONDS = 86400; // 1 day

/**
 * Generate MD5 hash of content for cache key
 */
export function getContentHash(text: string): string {
    return CryptoJS.MD5(text.trim().toLowerCase()).toString();
}

/**
 * Get cached AI feedback from Redis
 * @param contentHash - MD5 hash of the content
 * @returns Cached feedback or null
 */
export async function getCachedFeedback(contentHash: string): Promise<string | null> {
    try {
        const key = `${CACHE_PREFIX}${contentHash}`;
        const cached = await redis.get<string>(key);
        if (cached) {
            console.log('✓ Cache hit for content hash:', contentHash.slice(0, 8));
            return cached;
        }
        console.log('✗ Cache miss for content hash:', contentHash.slice(0, 8));
        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

/**
 * Cache AI feedback in Redis
 * @param contentHash - MD5 hash of the content
 * @param feedback - JSON string of feedback to cache
 */
export async function setCachedFeedback(contentHash: string, feedback: string): Promise<void> {
    try {
        const key = `${CACHE_PREFIX}${contentHash}`;
        await redis.set(key, feedback, { ex: CACHE_TTL_SECONDS });
        console.log('✓ Cached feedback for hash:', contentHash.slice(0, 8));
    } catch (error) {
        console.error('Redis set error:', error);
    }
}

/**
 * Check if Redis connection is healthy
 */
export async function isRedisHealthy(): Promise<boolean> {
    try {
        await redis.ping();
        return true;
    } catch (error) {
        console.error('Redis health check failed:', error);
        return false;
    }
}

// Circuit breaker state keys
const CIRCUIT_PREFIX = 'circuit:';
const CIRCUIT_FAILURE_TTL = 60; // Block failed provider for 1 minute

/**
 * Check if a provider is currently in circuit-breaker blocked state
 */
export async function isProviderBlocked(provider: string): Promise<boolean> {
    try {
        const key = `${CIRCUIT_PREFIX}${provider}`;
        const blocked = await redis.get<number>(key);
        return blocked !== null && blocked >= 3; // Block after 3 consecutive failures
    } catch (error) {
        console.error('Circuit breaker check error:', error);
        return false;
    }
}

/**
 * Record a provider failure
 */
export async function recordProviderFailure(provider: string): Promise<void> {
    try {
        const key = `${CIRCUIT_PREFIX}${provider}`;
        const current = await redis.get<number>(key) || 0;
        await redis.set(key, current + 1, { ex: CIRCUIT_FAILURE_TTL });
        console.log(`⚠ Provider ${provider} failure count: ${current + 1}`);
    } catch (error) {
        console.error('Record failure error:', error);
    }
}

/**
 * Reset provider failure count (on success)
 */
export async function resetProviderFailures(provider: string): Promise<void> {
    try {
        const key = `${CIRCUIT_PREFIX}${provider}`;
        await redis.del(key);
        console.log(`✓ Reset circuit breaker for ${provider}`);
    } catch (error) {
        console.error('Reset failure error:', error);
    }
}

// User block state
const USER_BLOCK_PREFIX = 'userblock:';
const USER_BLOCK_TTL = 60; // Block user for 1 minute if all providers fail

/**
 * Block a user temporarily
 */
export async function blockUser(clientId: string): Promise<void> {
    try {
        const key = `${USER_BLOCK_PREFIX}${clientId}`;
        await redis.set(key, Date.now(), { ex: USER_BLOCK_TTL });
        console.log(`🚫 Blocked user ${clientId} for ${USER_BLOCK_TTL}s`);
    } catch (error) {
        console.error('Block user error:', error);
    }
}

/**
 * Check if user is blocked
 */
export async function isUserBlocked(clientId: string): Promise<boolean> {
    try {
        const key = `${USER_BLOCK_PREFIX}${clientId}`;
        const blocked = await redis.get<number>(key);
        return blocked !== null;
    } catch (error) {
        console.error('Check user block error:', error);
        return false;
    }
}
