import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { CERTIFICATES, getCertificateById } from "@/constants/certificates";
import { NextResponse } from "next/server";
import { GeneratedTopic } from "@/types";
import { callOpenRouter } from "@/lib/openrouter";

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
    const { certificateId, band } = await req.json();

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
      certificate.format
    );

    // Strategy: Try OpenRouter (DeepSeek - free) first, then fallback to Gemini
    let result = null;
    let lastError = null;

    // Step 1: Try OpenRouter with DeepSeek (free tier)
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (openRouterKey) {
      console.log("Trying OpenRouter (DeepSeek free models) for topic generation...");
      result = await callOpenRouter(prompt, openRouterKey);
      if (result.success) {
        console.log("✓ OpenRouter succeeded for topic generation!");
      } else {
        console.log("✗ OpenRouter failed:", result.error);
        lastError = result.error;
      }
    }

    // Step 2: Fallback to Gemini if OpenRouter failed
    if (!result || !result.success) {
      console.log("Falling back to Gemini API for topic generation...");
      
      // Lấy 4 Gemini API keys từ environment variables
      const apiKeys = [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
      ].filter(Boolean) as string[];

      if (apiKeys.length === 0) {
        console.error("No Gemini API keys configured");
        // If OpenRouter also failed, return error
        if (!result || !result.success) {
          return NextResponse.json(
            { error: "No API keys configured" },
            { status: 500 }
          );
        }
      } else {
        // Thử từng Gemini API key cho đến khi thành công
        for (let i = 0; i < apiKeys.length; i++) {
          console.log(`Trying Gemini API key ${i + 1}/${apiKeys.length} for topic generation...`);
          result = await tryApiKey(apiKeys[i], prompt);
          if (result.success) {
            console.log(`✓ Gemini API key ${i + 1} succeeded for topic generation!`);
            break;
          } else {
            lastError = result.error;
          }
        }
      }
    }

    if (!result || !result.success) {
      console.error("All API keys failed for topic generation. Last error:", lastError);
      
      // Check if it's a quota error
      if (result?.error === "QUOTA_EXCEEDED" && result?.quotaError) {
        const quotaError = result.quotaError;
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

    let cleanJson = result.response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    try {
      const parsedData: GeneratedTopic = JSON.parse(cleanJson);
      
      // Validate structure
      if (!parsedData.title || !parsedData.sections || !Array.isArray(parsedData.sections)) {
        throw new Error("Invalid topic structure");
      }

      return NextResponse.json(parsedData);
    } catch (parseError: any) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", result.response.substring(0, 500));
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

