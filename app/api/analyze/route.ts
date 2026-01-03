import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { NextResponse } from "next/server";
import { callOpenRouter } from "@/lib/openrouter";

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
    const { userEn, sourceVn, target } = await req.json();

    const prompt = SYSTEM_PROMPTS.EVALUATOR(target, sourceVn) + `\nUser English Input: "${userEn}"`;

    // Strategy: Try OpenRouter (DeepSeek - free) first, then fallback to Gemini
    let result = null;
    let lastError = null;

    // Step 1: Try OpenRouter with DeepSeek (free tier)
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      console.log("Trying OpenRouter (DeepSeek free models)...");
      result = await callOpenRouter(prompt, openRouterKey);
      if (result.success) {
        console.log("✓ OpenRouter succeeded!");
      } else {
        console.log("✗ OpenRouter failed:", result.error);
        lastError = result.error;
      }
    }

    // Step 2: Fallback to Gemini if OpenRouter failed
    if (!result || !result.success) {
      console.log("Falling back to Gemini API...");
      
      // Lấy 4 Gemini API keys từ environment variables
      const apiKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
      ].filter(Boolean) as string[];

      console.log("Gemini API Keys found:", apiKeys.length, "keys");
      
      if (apiKeys.length === 0) {
        console.error("No Gemini API keys configured");
        // If OpenRouter also failed, return error
        if (!result || !result.success) {
          return NextResponse.json(
            { error: "No API keys configured. Please check your .env.local file." },
            { status: 500 }
          );
        }
      } else {
        // Thử từng Gemini API key cho đến khi thành công
        for (let i = 0; i < apiKeys.length; i++) {
          console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length}...`);
          result = await tryApiKey(apiKeys[i], prompt);
          if (result.success) {
            console.log(`✓ Gemini API key ${i + 1} succeeded!`);
            break;
          } else {
            lastError = result.error;
            console.log(`✗ Gemini API key ${i + 1} failed:`, lastError);
          }
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

