import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './upstash';

// Rate limiter: 10 requests per minute sliding window
const rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'ratelimit:main:',
    analytics: true,
});

// Burst limiter: 3 requests per 10 seconds
const burstLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, '10 s'),
    prefix: 'ratelimit:burst:',
});

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    reset: number;
    reason?: string;
    retryAfter?: number;
}

/**
 * Check rate limit using Upstash distributed rate limiter
 * Checks both main limit (10/min) and burst limit (3/10s)
 */
export async function checkRateLimitUpstash(clientId: string): Promise<RateLimitResult> {
    try {
        // First check burst limit
        const burstResult = await burstLimiter.limit(clientId);
        if (!burstResult.success) {
            const retryAfter = Math.ceil((burstResult.reset - Date.now()) / 1000);
            console.log(`⚠ Burst limit exceeded for ${clientId}. Reset in ${retryAfter}s`);
            return {
                allowed: false,
                remaining: 0,
                reset: burstResult.reset,
                reason: 'Quá nhiều yêu cầu trong thời gian ngắn. Vui lòng đợi vài giây.',
                retryAfter: Math.max(retryAfter, 5),
            };
        }

        // Then check main rate limit
        const mainResult = await rateLimiter.limit(clientId);
        if (!mainResult.success) {
            const retryAfter = Math.ceil((mainResult.reset - Date.now()) / 1000);
            console.log(`⚠ Rate limit exceeded for ${clientId}. Reset in ${retryAfter}s`);
            return {
                allowed: false,
                remaining: 0,
                reset: mainResult.reset,
                reason: 'Bạn đã vượt quá giới hạn 10 yêu cầu/phút. Vui lòng đợi.',
                retryAfter,
            };
        }

        console.log(`✓ Rate limit OK for ${clientId}: ${mainResult.remaining} remaining`);
        return {
            allowed: true,
            remaining: mainResult.remaining,
            reset: mainResult.reset,
        };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request but log it
        return {
            allowed: true,
            remaining: -1,
            reset: 0,
        };
    }
}

/**
 * Get client identifier (IP + User Agent hash)
 */
export function getClientId(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Simple hash for client identification
    const hash = Buffer.from(`${ip}-${userAgent}`).toString('base64').slice(0, 20);
    return `${ip}-${hash}`;
}
