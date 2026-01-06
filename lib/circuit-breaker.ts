import { GoogleGenAI } from '@google/genai';
import {
    isProviderBlocked,
    recordProviderFailure,
    resetProviderFailures,
    blockUser,
    isUserBlocked
} from './upstash';
import { callOpenRouter } from './openrouter';
import { callGitHubModels } from './github-models';

// Provider configuration
export type AIProvider = 'github' | 'gemini' | 'openrouter';

interface AICallResult {
    success: boolean;
    response?: string;
    error?: string;
    provider?: AIProvider;
}

// Model names for Gemini
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-1.5-flash',
    'gemini-pro',
];

/**
 * Try to call Gemini API
 */
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
                    console.log(`⚠ Gemini quota exceeded`);
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

/**
 * Call AI with circuit breaker pattern
 * Order: GitHub Models → Gemini → OpenRouter
 * Auto-skip blocked providers, block user if all fail
 */
export async function callAIWithCircuitBreaker(
    prompt: string,
    clientId: string
): Promise<AICallResult> {
    // Check if user is temporarily blocked
    if (await isUserBlocked(clientId)) {
        return {
            success: false,
            error: 'Tất cả AI providers đang bận. Vui lòng thử lại sau 1 phút.',
        };
    }

    let lastError = '';

    // 1. Try GitHub Models first
    if (!(await isProviderBlocked('github'))) {
        const githubKeys = [
            process.env.GITHUB_MODELS_API_KEY_1,
            process.env.GITHUB_MODELS_API_KEY_2,
        ].filter(Boolean) as string[];

        if (githubKeys.length > 0) {
            console.log('🔄 Trying GitHub Models...');
            const result = await callGitHubModels(prompt, githubKeys);
            if (result.success) {
                await resetProviderFailures('github');
                return { success: true, response: result.response, provider: 'github' };
            }
            await recordProviderFailure('github');
            lastError = result.error || 'GitHub Models failed';
        }
    } else {
        console.log('⏭ Skipping GitHub Models (circuit open)');
    }

    // 2. Try Gemini
    if (!(await isProviderBlocked('gemini'))) {
        const geminiKeys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY_4,
        ].filter(Boolean) as string[];

        if (geminiKeys.length > 0) {
            console.log('🔄 Trying Gemini...');
            for (const key of geminiKeys) {
                const result = await callGemini(prompt, key);
                if (result.success) {
                    await resetProviderFailures('gemini');
                    return result;
                }
                if (result.error === 'QUOTA_EXCEEDED') {
                    continue; // Try next key
                }
                lastError = result.error || 'Gemini failed';
            }
            await recordProviderFailure('gemini');
        }
    } else {
        console.log('⏭ Skipping Gemini (circuit open)');
    }

    // 3. Try OpenRouter (DeepSeek)
    if (!(await isProviderBlocked('openrouter'))) {
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        if (openRouterKey) {
            console.log('🔄 Trying OpenRouter...');
            const result = await callOpenRouter(prompt, openRouterKey);
            if (result.success) {
                await resetProviderFailures('openrouter');
                return { success: true, response: result.response, provider: 'openrouter' };
            }
            await recordProviderFailure('openrouter');
            lastError = result.error || 'OpenRouter failed';
        }
    } else {
        console.log('⏭ Skipping OpenRouter (circuit open)');
    }

    // All providers failed - block user temporarily
    console.error('❌ All AI providers failed. Blocking user for 1 minute.');
    await blockUser(clientId);

    return {
        success: false,
        error: `Tất cả AI providers đang gặp sự cố. Vui lòng thử lại sau 1 phút. (${lastError})`,
    };
}
