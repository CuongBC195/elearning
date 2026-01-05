import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { NextResponse } from "next/server";
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
  "gemini-1.5-flash",      // Fallback
  "gemini-pro",            // Fallback
  "gemini-1.5-pro",        // Fallback
];

// Hàm thử API key với nhiều model names
async function tryApiKey(apiKey: string, prompt: string): Promise<{ success: boolean; response?: string; error?: string; quotaError?: any }> {
  // SDK mới sử dụng environment variable GEMINI_API_KEY
  // Save original và set API key mới
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
        console.log(`✓ Successfully used model: ${modelName}`);
        return { success: true, response: text };
      } catch (error: any) {
        // Nếu là lỗi 404 (model not found), thử model tiếp theo
        if (error?.message?.includes("404") || error?.message?.includes("not found")) {
          console.log(`✗ Model ${modelName} not found, trying next...`);
          continue;
        }
        // Nếu là lỗi 429 (quota exceeded), parse error để lấy thông tin
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
    // Restore original API key
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
    logRequest(clientId, '/api/analyze', req);
    
    // === END SECURITY CHECKS ===

    const body = await req.json();
    
    // 4. Validate request body
    const validation = validateRequestBody(body, ['userEn', 'target']);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }
    
    const { userEn, sourceVn, target } = body;

    const prompt = SYSTEM_PROMPTS.EVALUATOR(target, sourceVn) + `\nUser English Input: "${userEn}"`;

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
      console.error("All API keys failed. Last error:", lastError);
      
      // Check if it's a quota error (only from Gemini, not OpenRouter)
      if (result && 'quotaError' in result && result.error === "QUOTA_EXCEEDED") {
        const quotaError = (result as any).quotaError;
        const limit = quotaError.details?.[0]?.violations?.[0]?.quotaValue || "20";
        const metric = quotaError.details?.[0]?.violations?.[0]?.quotaMetric?.split('/').pop() || "requests per day";
        
        return NextResponse.json(
          { 
            error: "API Quota Exceeded",
            details: `You have exceeded the free tier quota (${limit} ${metric} per day). Please try again tomorrow or upgrade your plan.`,
            quotaInfo: {
              limit,
              metric,
              retryAfter: quotaError.details?.find((d: any) => d["@type"]?.includes("RetryInfo"))?.retryDelay || null
            },
            type: "QUOTA_EXCEEDED"
          },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          error: "All API keys failed. Please check your API keys.",
          details: typeof lastError === 'string' ? lastError : JSON.stringify(lastError).substring(0, 200)
        },
        { status: 500 }
      );
    }

    // Xử lý response từ Gemini - extract JSON
    if (!result.response) {
      return NextResponse.json(
        { error: "No response from API" },
        { status: 500 }
      );
    }

    let cleanJson = result.response.trim();
    
    // Loại bỏ markdown code blocks nếu có
    cleanJson = cleanJson.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();
    
    // Tìm JSON object trong response (có thể có text trước/sau)
    const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanJson = jsonMatch[0];
    }
    
    // Parse JSON để đảm bảo tính hợp lệ
    try {
      const parsedData = JSON.parse(cleanJson);
      
      // Validate structure cơ bản
      if (typeof parsedData.accuracy !== 'number' || 
          !parsedData.vocabulary_status || 
          !parsedData.grammar_status) {
        throw new Error("Invalid JSON structure");
      }
      
      return NextResponse.json(parsedData);
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError);
      console.error("Response text (first 1000 chars):", result.response.substring(0, 1000));
      
      // Thử parse lại với regex tìm JSON
      try {
        // Tìm tất cả JSON objects
        const jsonObjects = result.response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
        if (jsonObjects && jsonObjects.length > 0) {
          // Thử parse từng object
          for (const jsonStr of jsonObjects) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.accuracy !== undefined) {
                console.log("Successfully parsed JSON from extracted object");
                return NextResponse.json(parsed);
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
          rawResponse: result.response.substring(0, 500),
          hint: "AI may have returned text instead of JSON. Check the prompt."
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

