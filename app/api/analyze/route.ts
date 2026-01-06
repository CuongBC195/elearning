import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { NextResponse } from "next/server";
import { checkRateLimitUpstash, getClientId } from "@/lib/rate-limit-upstash";
import { callAIWithCircuitBreaker } from "@/lib/circuit-breaker";
import {
  getCachedFeedback,
  setCachedFeedback,
  getContentHash,
  isUserBlocked,
} from "@/lib/upstash";

export async function POST(req: Request) {
  try {
    // === SECURITY CHECKS (Upstash Distributed) ===
    const clientId = getClientId(req);

    // 1. Check if user is temporarily blocked (all providers failed)
    if (await isUserBlocked(clientId)) {
      console.warn(`[BLOCKED] User ${clientId} is temporarily blocked`);
      return NextResponse.json(
        { error: "Tất cả AI providers đang bận. Vui lòng thử lại sau 1 phút." },
        {
          status: 429,
          headers: { 'Retry-After': '60' }
        }
      );
    }

    // 2. Check distributed rate limit (Upstash)
    const rateLimitResult = await checkRateLimitUpstash(clientId);
    if (!rateLimitResult.allowed) {
      console.warn(`[BLOCKED] Rate limit exceeded for ${clientId}`);
      return NextResponse.json(
        { error: rateLimitResult.reason },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // === END SECURITY CHECKS ===

    const body = await req.json();

    // 3. Validate request body
    const { userEn, sourceVn, target } = body;
    if (!userEn || typeof userEn !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid 'userEn' field" },
        { status: 400 }
      );
    }
    if (!target || typeof target !== 'string') {
      return NextResponse.json(
        { error: "Missing or invalid 'target' field" },
        { status: 400 }
      );
    }

    // 4. Check Redis cache - return instantly if cached
    const cacheKey = getContentHash(`${userEn}|${sourceVn || ''}|${target}`);
    const cachedResponse = await getCachedFeedback(cacheKey);

    if (cachedResponse) {
      console.log(`✓ Cache HIT - returning cached feedback for ${clientId}`);
      try {
        const parsed = JSON.parse(cachedResponse);
        return NextResponse.json(parsed, {
          headers: { 'X-Cache': 'HIT' }
        });
      } catch (e) {
        console.error('Error parsing cached response:', e);
        // Continue to call AI if cache is corrupted
      }
    }

    console.log(`✗ Cache MISS - calling AI for ${clientId}`);

    // 5. Build prompt
    const prompt = SYSTEM_PROMPTS.EVALUATOR(target, sourceVn) + `\nUser English Input: "${userEn}"`;

    // 6. Call AI with Circuit Breaker (auto-failover)
    const result = await callAIWithCircuitBreaker(prompt, clientId);

    if (!result.success) {
      console.error("All AI providers failed:", result.error);
      return NextResponse.json(
        {
          error: result.error || "All API providers failed",
          type: "AI_ERROR"
        },
        { status: 503 }
      );
    }

    // 7. Process response - extract JSON
    if (!result.response) {
      return NextResponse.json(
        { error: "No response from API" },
        { status: 500 }
      );
    }

    let cleanJson = result.response.trim();

    // Remove markdown code blocks if present
    cleanJson = cleanJson.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

    // Find JSON object in response
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }

    // 8. Parse JSON and validate
    try {
      const parsedData = JSON.parse(cleanJson);

      // Validate basic structure
      if (typeof parsedData.accuracy !== 'number' ||
        !parsedData.vocabulary_status ||
        !parsedData.grammar_status) {
        throw new Error("Invalid JSON structure");
      }

      // 9. Cache the successful response in Redis
      await setCachedFeedback(cacheKey, JSON.stringify(parsedData));

      return NextResponse.json(parsedData, {
        headers: {
          'X-Cache': 'MISS',
          'X-Provider': result.provider || 'unknown'
        }
      });
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError);
      console.error("Response text (first 500 chars):", result.response.substring(0, 500));

      // Try to find and parse JSON objects
      try {
        const jsonObjects = result.response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonObjects && jsonObjects.length > 0) {
          for (const jsonStr of jsonObjects) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.accuracy !== undefined) {
                console.log("Successfully parsed JSON from extracted object");
                // Cache it
                await setCachedFeedback(cacheKey, JSON.stringify(parsed));
                return NextResponse.json(parsed, {
                  headers: {
                    'X-Cache': 'MISS',
                    'X-Provider': result.provider || 'unknown'
                  }
                });
              }
            } catch (e) {
              continue;
            }
          }
        }
      } catch (e) {
        // Ignore
      }

      return NextResponse.json(
        {
          error: "Failed to parse AI response as JSON",
          details: parseError.message,
          hint: "AI may have returned text instead of JSON."
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in analyze route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
