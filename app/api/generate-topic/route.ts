import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { CERTIFICATES, getCertificateById } from "@/constants/certificates";
import { NextResponse } from "next/server";
import { GeneratedTopic } from "@/types";
import { callOpenRouter } from "@/lib/openrouter";
import { callGitHubModels } from "@/lib/github-models";
import { 
  getClientId, 
  checkRateLimit, 
  detectSuspiciousBehavior, 
  validateRequestBody,
  logRequest 
} from "@/lib/rate-limiter";

// Thử các tên model khác nhau (theo thứ tự ưu tiên)
// gemini-2.5-flash là model mới nhất (1,500 requests/ngày ở bản miễn phí)
const MODEL_NAMES = [
  "gemini-2.5-flash",      // Model mới nhất (recommended)
];

// Hàm thử API key với gemini-1.5-flash
async function tryApiKey(apiKey: string, prompt: string) {
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = apiKey;
  
  try {
    const ai = new GoogleGenAI({});
    
    // Thử từng model name
    for (const modelName of MODEL_NAMES) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
        });
        const text = response.text;
        console.log(`✓ Successfully used model: ${modelName} for topic generation`);
        return { success: true, response: text };
      } catch (error: any) {
        // Nếu là lỗi 404 (model not found), thử model tiếp theo
        if (error?.message?.includes("404") || error?.message?.includes("not found")) {
          console.log(`✗ Model ${modelName} not found, trying next...`);
          continue;
        }
        // Handle quota exceeded
        if (error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
          try {
            const errorObj = typeof error.message === 'string' ? JSON.parse(error.message) : error.message;
            if (errorObj?.error?.code === 429) {
              return { 
                success: false, 
                error: "QUOTA_EXCEEDED",
                quotaError: errorObj.error
              };
            }
          } catch (e) {
            // Ignore parse error
          }
        }
        // Nếu là lỗi khác (auth, etc), trả về lỗi ngay
        console.error(`API Key error with model ${modelName}:`, error?.message || error);
        return { success: false, error: error?.message || String(error) };
      }
    }
    
    // Nếu tất cả models đều không tìm thấy
    return { 
      success: false, 
      error: "None of the available model names were found. Please check your API key permissions." 
    };
  } finally {
    if (originalApiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalApiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
}

export async function POST(req: Request) {
  try {
    // === SECURITY CHECKS ===
    const clientId = getClientId(req);
    
    // 1. Check rate limit
    const rateLimitResult = checkRateLimit(clientId);
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
    
    // 2. Check suspicious behavior
    const suspiciousResult = detectSuspiciousBehavior(clientId, req);
    if (suspiciousResult.suspicious) {
      console.warn(`[BLOCKED] Suspicious behavior from ${clientId}: ${suspiciousResult.reason}`);
      return NextResponse.json(
        { error: suspiciousResult.reason },
        { status: 403 }
      );
    }
    
    // 3. Log this request
    logRequest(clientId, '/api/generate-topic', req);
    
    // === END SECURITY CHECKS ===

    const body = await req.json();
    
    // 4. Validate request body
    const validation = validateRequestBody(body, ['certificateId', 'band']);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }
    
    const { certificateId, band, contentType, outlineLanguage } = body;

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
    
    console.log(`Content type: ${isOutlineMode ? "Outline (dàn bài)" : "Full (đoạn văn đầy đủ)"}`);
    console.log(`Language: ${useEnglish ? "English" : "Vietnamese"}`);

    // Lấy 3 API keys từ environment variables
    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
    ].filter(Boolean) as string[];

    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: "No API keys configured" },
        { status: 500 }
      );
    }

    const prompt = SYSTEM_PROMPTS.TOPIC_GENERATOR(
      certificate.fullName,
      band,
      certificate.format,
      isOutlineMode,
      useEnglish
    );

    // Strategy: GitHub Models → Gemini → OpenRouter
    let result = null;
    let lastError = null;

    // Step 1: Try GitHub Models first (fastest, Copilot Pro)
    const githubModelsKeys = [
      process.env.GITHUB_MODELS_API_KEY_1,
      process.env.GITHUB_MODELS_API_KEY_2,
    ].filter(Boolean) as string[];
    console.log(`GitHub Models keys: ${githubModelsKeys.length} found`);
    
    if (githubModelsKeys.length > 0) {
      console.log("Trying GitHub Models (GPT-4o mini, Llama 3.3)...");
      result = await callGitHubModels(prompt, githubModelsKeys);
      if (result.success) {
        console.log("✓ GitHub Models succeeded!");
      } else {
        console.log("✗ GitHub Models failed:", result.error);
        lastError = result.error;
      }
    }

    // Step 2: Fallback to Gemini if GitHub Models failed
    if (!result || !result.success) {
      console.log("Falling back to Gemini API...");
      const geminiKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
      ].filter(Boolean) as string[];

      if (geminiKeys.length > 0) {
        for (let i = 0; i < geminiKeys.length; i++) {
          console.log(`Trying Gemini key ${i + 1}/${geminiKeys.length}...`);
          result = await tryApiKey(geminiKeys[i], prompt);
          if (result.success) {
            console.log(`✓ Gemini key ${i + 1} succeeded!`);
            break;
          } else {
            console.log(`✗ Gemini key ${i + 1} failed:`, result.error);
            lastError = result.error;
          }
        }
      }
    }

    // Step 3: Last resort - OpenRouter (DeepSeek free)
    if (!result || !result.success) {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        console.log("Falling back to OpenRouter (DeepSeek)...");
        result = await callOpenRouter(prompt, openRouterKey);
        if (result.success) {
          console.log("✓ OpenRouter succeeded!");
        } else {
          console.log("✗ OpenRouter failed:", result.error);
          lastError = result.error;
        }
      }
    }

    if (!result || !result.success) {
      console.error("All API keys failed for topic generation. Last error:", lastError);
      
      // Check if it's a quota error (only from Gemini, not OpenRouter)
      if (result && 'quotaError' in result && result.error === "QUOTA_EXCEEDED") {
        const quotaError = (result as any).quotaError;
        const limit = quotaError.details?.[0]?.violations?.[0]?.quotaValue || "20";
        
        return NextResponse.json(
          { 
            error: "API Quota Exceeded",
            details: `You have exceeded the free tier quota (${limit} requests per day). Please try again tomorrow or upgrade your plan.`,
            type: "QUOTA_EXCEEDED"
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "Failed to generate topic",
          details: typeof lastError === 'string' ? lastError : JSON.stringify(lastError).substring(0, 200)
        },
        { status: 500 }
      );
    }

    // Xử lý response từ Gemini
    if (!result.response) {
      return NextResponse.json(
        { error: "No response from API" },
        { status: 500 }
      );
    }

    // Normalize JSON response from model (strip fences, grab braces segment)
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
        // Remove trailing commas before closing braces/brackets
        payload.replace(/,(\s*[}\]])/g, "$1"),
        newlineEscaped.replace(/,(\s*[}\]])/g, "$1"),
        // Quote unquoted keys (best-effort)
        payload.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":'),
        newlineEscaped.replace(/([\{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":'),
        // Convert single quotes to double quotes
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

      return NextResponse.json(parsedData);
    } catch (parseError: any) {
      console.error("Topic parse failed", {
        message: parseError?.message,
        cleanJsonSnippet: cleanJson.slice(0, 400),
        rawResponseSnippet: rawResponse.slice(0, 400)
      });
      return NextResponse.json(
        {
          error: "Failed to parse AI response",
          details: parseError.message,
          rawResponse: result.response.substring(0, 500)
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

