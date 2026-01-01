import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { NextResponse } from "next/server";

// Danh sách model names để thử (theo thứ tự ưu tiên)
const MODEL_NAMES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash-exp",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

// Hàm thử API key với nhiều model names
async function tryApiKey(apiKey: string, prompt: string) {
  // SDK mới sử dụng environment variable GEMINI_API_KEY
  // Save original và set API key mới
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = apiKey;
  
  try {
    const ai = new GoogleGenAI({});
    
    // Thử từng model name cho đến khi tìm thấy model hoạt động
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

    // Lấy 4 API keys từ environment variables
    const apiKeys = [
      process.env.GEMINI_API_KEY_1,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
    ].filter(Boolean) as string[];

    console.log("API Keys found:", apiKeys.length, "keys");
    
    if (apiKeys.length === 0) {
      console.error("No API keys configured in environment variables");
      return NextResponse.json(
        { error: "No API keys configured. Please check your .env.local file." },
        { status: 500 }
      );
    }

    const prompt = SYSTEM_PROMPTS.EVALUATOR(target, sourceVn) + `\nUser English Input: "${userEn}"`;

    // Thử từng API key cho đến khi thành công
    let result = null;
    let lastError = null;
    for (let i = 0; i < apiKeys.length; i++) {
      console.log(`Trying API key ${i + 1}/${apiKeys.length}...`);
      result = await tryApiKey(apiKeys[i], prompt);
      if (result.success) {
        console.log(`API key ${i + 1} succeeded!`);
        break;
      } else {
        lastError = result.error;
        console.log(`API key ${i + 1} failed:`, lastError);
      }
    }

    if (!result || !result.success) {
      console.error("All API keys failed. Last error:", lastError);
      
      // Check if it's a quota error
      if (result?.error === "QUOTA_EXCEEDED" && result?.quotaError) {
        const quotaError = result.quotaError;
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

