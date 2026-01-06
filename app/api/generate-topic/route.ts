import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { getCertificateById } from "@/constants/certificates";
import { NextResponse } from "next/server";
import { GeneratedTopic } from "@/types";
import { checkRateLimitUpstash, getClientId } from "@/lib/rate-limit-upstash";
import { callAIWithCircuitBreaker } from "@/lib/circuit-breaker";
import { isUserBlocked } from "@/lib/upstash";

export async function POST(req: Request) {
  try {
    // === SECURITY CHECKS (Upstash Distributed) ===
    const clientId = getClientId(req);

    // 1. Check if user is temporarily blocked
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
    const { certificateId, band, contentType, outlineLanguage } = body;

    // Validate request body
    if (!certificateId || !band) {
      return NextResponse.json(
        { error: "certificateId and band are required" },
        { status: 400 }
      );
    }

    const certificate = getCertificateById(certificateId);
    if (!certificate) {
      return NextResponse.json(
        { error: "Invalid certificate ID" },
        { status: 400 }
      );
    }

    // Determine content type (default to full)
    const isOutlineMode = contentType === "outline";
    const useEnglish = outlineLanguage === "english";

    console.log(`Content type: ${isOutlineMode ? "Outline" : "Full"}, Language: ${useEnglish ? "English" : "Vietnamese"}`);

    // Build prompt
    const prompt = SYSTEM_PROMPTS.TOPIC_GENERATOR(
      certificate.fullName,
      band,
      certificate.format,
      isOutlineMode,
      useEnglish
    );

    // Call AI with Circuit Breaker (auto-failover)
    const result = await callAIWithCircuitBreaker(prompt, clientId);

    if (!result.success) {
      console.error("All AI providers failed for topic generation:", result.error);
      return NextResponse.json(
        {
          error: result.error || "Failed to generate topic",
          type: "AI_ERROR"
        },
        { status: 503 }
      );
    }

    // Process response
    if (!result.response) {
      return NextResponse.json(
        { error: "No response from API" },
        { status: 500 }
      );
    }

    // Normalize JSON response
    const rawResponse = typeof result.response === "string" ? result.response : JSON.stringify(result.response);
    const fencedStripped = rawResponse.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    const firstBrace = fencedStripped.indexOf("{");
    const lastBrace = fencedStripped.lastIndexOf("}");
    const sliced = firstBrace !== -1 && lastBrace !== -1 ? fencedStripped.slice(firstBrace, lastBrace + 1) : fencedStripped;
    let cleanJson = sliced;

    const balanceBraces = (payload: string) => {
      const opens = (payload.match(/\{/g) || []).length;
      const closes = (payload.match(/\}/g) || []).length;
      if (opens > closes) {
        return payload + "}".repeat(opens - closes);
      }
      return payload;
    };

    const tryParsers = (payload: string) => {
      const newlineEscaped = payload.replace(/\r?\n/g, "\\n");

      const variants = [
        payload,
        newlineEscaped,
        balanceBraces(payload),
        balanceBraces(newlineEscaped),
        payload.replace(/,(\s*[}\]])/g, "$1"),
        newlineEscaped.replace(/,(\s*[}\]])/g, "$1"),
        payload.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":'),
        newlineEscaped.replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":'),
        payload.replace(/'/g, '"'),
        newlineEscaped.replace(/'/g, '"'),
      ];

      for (const variant of variants) {
        try {
          return JSON.parse(variant);
        } catch (e) {
          continue;
        }
      }
      throw new Error("Unable to parse AI JSON");
    };

    try {
      const parsedData: GeneratedTopic = tryParsers(cleanJson);

      // Validate structure
      if (!parsedData.title || !parsedData.sections || !Array.isArray(parsedData.sections)) {
        throw new Error("Invalid topic structure");
      }

      return NextResponse.json(parsedData, {
        headers: { 'X-Provider': result.provider || 'unknown' }
      });
    } catch (parseError: any) {
      console.error("Topic parse failed", parseError);
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          details: parseError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in generate-topic route:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
