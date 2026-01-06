import { GoogleGenAI } from '@google/genai';
import { redis } from './upstash';
import { callOpenRouter } from './openrouter';
import { callGitHubModels } from './github-models';

// ============================================================================
// SMART KEY LOAD BALANCER + CIRCUIT BREAKER
// ============================================================================
// - Tracks "in-flight" requests per key using Redis
// - Selects the least busy key first
// - Falls back to next available key on failure
// - Circuit breaker: blocks keys with 3+ consecutive failures
// ============================================================================

// Redis key prefixes
const INFLIGHT_PREFIX = 'inflight:';
const CIRCUIT_PREFIX = 'circuit:';
const USER_BLOCK_PREFIX = 'userblock:';

// Config
const CIRCUIT_FAILURE_THRESHOLD = 3;  // Block key after 3 failures
const CIRCUIT_RESET_TTL = 60;         // Reset circuit after 60s
const INFLIGHT_TTL = 30;              // Safety: auto-clear stuck inflight after 30s
const USER_BLOCK_TTL = 60;            // Block user for 60s if all keys fail

// Model names for Gemini
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-pro'];

// Provider/Key configuration
interface APIKey {
    id: string;           // Unique identifier: 'github:0', 'gemini:1', etc.
    provider: 'github' | 'gemini' | 'openrouter';
    key: string;
    priority: number;     // Lower = higher priority
}

// ============================================================================
// INFLIGHT TRACKING
// ============================================================================

async function getInflightCount(keyId: string): Promise<number> {
    try {
        const count = await redis.get<number>(`${INFLIGHT_PREFIX}${keyId}`);
        return count || 0;
    } catch {
        return 0;
    }
}

async function incrementInflight(keyId: string): Promise<void> {
    try {
        const key = `${INFLIGHT_PREFIX}${keyId}`;
        await redis.incr(key);
        await redis.expire(key, INFLIGHT_TTL);
    } catch (e) {
        console.error('Failed to increment inflight:', e);
    }
}

async function decrementInflight(keyId: string): Promise<void> {
    try {
        const key = `${INFLIGHT_PREFIX}${keyId}`;
        const current = await redis.get<number>(key);
        if (current && current > 0) {
            await redis.decr(key);
        }
    } catch (e) {
        console.error('Failed to decrement inflight:', e);
    }
}

// ============================================================================
// CIRCUIT BREAKER STATE
// ============================================================================

async function isKeyBlocked(keyId: string): Promise<boolean> {
    try {
        const failures = await redis.get<number>(`${CIRCUIT_PREFIX}${keyId}`);
        return failures !== null && failures >= CIRCUIT_FAILURE_THRESHOLD;
    } catch {
        return false;
    }
}

async function recordKeyFailure(keyId: string): Promise<void> {
    try {
        const key = `${CIRCUIT_PREFIX}${keyId}`;
        const current = await redis.get<number>(key) || 0;
        await redis.set(key, current + 1, { ex: CIRCUIT_RESET_TTL });
        console.log(`⚠ Key ${keyId} failure count: ${current + 1}`);
    } catch (e) {
        console.error('Failed to record key failure:', e);
    }
}

async function resetKeyFailures(keyId: string): Promise<void> {
    try {
        await redis.del(`${CIRCUIT_PREFIX}${keyId}`);
        console.log(`✓ Reset circuit for ${keyId}`);
    } catch (e) {
        console.error('Failed to reset key failures:', e);
    }
}

// ============================================================================
// USER BLOCKING
// ============================================================================

export async function isUserBlocked(clientId: string): Promise<boolean> {
    try {
        const blocked = await redis.get<number>(`${USER_BLOCK_PREFIX}${clientId}`);
        return blocked !== null;
    } catch {
        return false;
    }
}

async function blockUser(clientId: string): Promise<void> {
    try {
        await redis.set(`${USER_BLOCK_PREFIX}${clientId}`, Date.now(), { ex: USER_BLOCK_TTL });
        console.log(`🚫 Blocked user ${clientId} for ${USER_BLOCK_TTL}s`);
    } catch (e) {
        console.error('Failed to block user:', e);
    }
}

// ============================================================================
// GET ALL AVAILABLE KEYS
// ============================================================================

function getAllAPIKeys(): APIKey[] {
    const keys: APIKey[] = [];

    // GitHub Models keys (priority 0 - highest)
    const githubKeys = [
        process.env.GITHUB_MODELS_API_KEY_1,
        process.env.GITHUB_MODELS_API_KEY_2,
    ].filter(Boolean) as string[];

    githubKeys.forEach((key, i) => {
        keys.push({ id: `github:${i}`, provider: 'github', key, priority: 0 });
    });

    // Gemini keys (priority 1)
    const geminiKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
    ].filter(Boolean) as string[];

    geminiKeys.forEach((key, i) => {
        keys.push({ id: `gemini:${i}`, provider: 'gemini', key, priority: 1 });
    });

    // OpenRouter key (priority 2 - lowest, fallback)
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
        keys.push({ id: 'openrouter:0', provider: 'openrouter', key: openRouterKey, priority: 2 });
    }

    return keys;
}

// ============================================================================
// SMART KEY SELECTION (Least Inflight + Not Blocked)
// ============================================================================

async function selectBestKey(allKeys: APIKey[]): Promise<APIKey | null> {
    // Get inflight counts and blocked status for all keys
    const keyStats = await Promise.all(
        allKeys.map(async (k) => ({
            key: k,
            inflight: await getInflightCount(k.id),
            blocked: await isKeyBlocked(k.id),
        }))
    );

    // Filter out blocked keys
    const available = keyStats.filter(s => !s.blocked);

    if (available.length === 0) {
        console.log('❌ All keys are blocked by circuit breaker');
        return null;
    }

    // Sort by: 1) priority (lower first), 2) inflight count (lower first)
    available.sort((a, b) => {
        if (a.key.priority !== b.key.priority) {
            return a.key.priority - b.key.priority;
        }
        return a.inflight - b.inflight;
    });

    const selected = available[0];
    console.log(`🎯 Selected key: ${selected.key.id} (inflight: ${selected.inflight}, priority: ${selected.key.priority})`);

    return selected.key;
}

// ============================================================================
// CALL SINGLE KEY
// ============================================================================

interface AICallResult {
    success: boolean;
    response?: string;
    error?: string;
    provider?: string;
}

async function callWithKey(key: APIKey, prompt: string): Promise<AICallResult> {
    switch (key.provider) {
        case 'github':
            return await callGitHubModels(prompt, [key.key]);

        case 'gemini':
            return await callGemini(prompt, key.key);

        case 'openrouter':
            return await callOpenRouter(prompt, key.key);

        default:
            return { success: false, error: 'Unknown provider' };
    }
}

async function callGemini(prompt: string, apiKey: string): Promise<AICallResult> {
    const originalApiKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = apiKey;

    try {
        const ai = new GoogleGenAI({});

        for (const modelName of GEMINI_MODELS) {
            try {
                const response = await ai.models.generateContent({
                    model: modelName,
                    contents: prompt,
                });
                const text = response.text;
                console.log(`✓ Gemini ${modelName} succeeded`);
                return { success: true, response: text, provider: 'gemini' };
            } catch (error: any) {
                if (error?.message?.includes('404') || error?.message?.includes('not found')) {
                    continue;
                }
                if (error?.message?.includes('429') || error?.message?.includes('quota')) {
                    return { success: false, error: 'QUOTA_EXCEEDED', provider: 'gemini' };
                }
                return { success: false, error: error?.message || String(error), provider: 'gemini' };
            }
        }

        return { success: false, error: 'No Gemini model available', provider: 'gemini' };
    } finally {
        if (originalApiKey !== undefined) {
            process.env.GEMINI_API_KEY = originalApiKey;
        } else {
            delete process.env.GEMINI_API_KEY;
        }
    }
}

// ============================================================================
// MAIN: CALL AI WITH SMART LOAD BALANCING + FALLBACK
// ============================================================================

export async function callAIWithCircuitBreaker(
    prompt: string,
    clientId: string
): Promise<AICallResult> {
    // Check if user is blocked
    if (await isUserBlocked(clientId)) {
        return {
            success: false,
            error: 'Tất cả AI providers đang bận. Vui lòng thử lại sau 1 phút.',
        };
    }

    const allKeys = getAllAPIKeys();
    if (allKeys.length === 0) {
        return { success: false, error: 'No API keys configured' };
    }

    const triedKeys = new Set<string>();
    let lastError = '';

    // Keep trying until we succeed or exhaust all keys
    while (triedKeys.size < allKeys.length) {
        // Get remaining keys (not tried yet)
        const remainingKeys = allKeys.filter(k => !triedKeys.has(k.id));

        // Select best key from remaining
        const selectedKey = await selectBestKey(remainingKeys);

        if (!selectedKey) {
            // All remaining keys are blocked
            break;
        }

        triedKeys.add(selectedKey.id);

        // Track inflight
        await incrementInflight(selectedKey.id);

        try {
            console.log(`🔄 Trying ${selectedKey.id}...`);
            const result = await callWithKey(selectedKey, prompt);

            if (result.success) {
                // Success! Reset failure count and decrement inflight
                await resetKeyFailures(selectedKey.id);
                await decrementInflight(selectedKey.id);

                return {
                    success: true,
                    response: result.response,
                    provider: selectedKey.id,
                };
            }

            // Failed - record failure and try next
            await recordKeyFailure(selectedKey.id);
            await decrementInflight(selectedKey.id);
            lastError = result.error || 'Unknown error';
            console.log(`✗ ${selectedKey.id} failed: ${lastError}`);

        } catch (error: any) {
            // Exception - record failure
            await recordKeyFailure(selectedKey.id);
            await decrementInflight(selectedKey.id);
            lastError = error?.message || String(error);
            console.error(`✗ ${selectedKey.id} exception:`, lastError);
        }
    }

    // All keys failed - block user
    console.error('❌ All API keys exhausted. Blocking user.');
    await blockUser(clientId);

    return {
        success: false,
        error: `Tất cả AI providers đang gặp sự cố. Vui lòng thử lại sau 1 phút. (${lastError})`,
    };
}
