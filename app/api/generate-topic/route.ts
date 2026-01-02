import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPTS } from "@/constants/prompts";
import { CERTIFICATES, getCertificateById } from "@/constants/certificates";
import { NextResponse } from "next/server";
import { GeneratedTopic } from "@/types";

// Sử dụng gemini-1.5-flash (1,500 requests/ngày ở bản miễn phí)
const MODEL_NAME = "gemini-1.5-flash";

// Hàm thử API key với gemini-1.5-flash
async function tryApiKey(apiKey: string, prompt: string) {
  const originalApiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = apiKey;
  
  try {
    const ai = new GoogleGenAI({});
    
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      const text = response.text;
      console.log(`✓ Successfully used model: ${MODEL_NAME} for topic generation`);
      return { success: true, response: text };
    } catch (error: any) {
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
      // Nếu là lỗi khác (auth, 404, etc), trả về lỗi ngay
      console.error(`API Key error with model ${MODEL_NAME}:`, error?.message || error);
      return { success: false, error: error?.message || String(error) };
    }
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

    // Thử từng API key cho đến khi thành công
    let result = null;
    let lastError = null;
    for (let i = 0; i < apiKeys.length; i++) {
      console.log(`Trying API key ${i + 1}/${apiKeys.length} for topic generation...`);
      result = await tryApiKey(apiKeys[i], prompt);
      if (result.success) {
        console.log(`API key ${i + 1} succeeded for topic generation!`);
        break;
      } else {
        lastError = result.error;
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

