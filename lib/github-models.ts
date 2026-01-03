/**
 * GitHub Models API helper functions
 * Uses DeepSeek-V3 and Gemini 2.0 Flash (fast models < 5s)
 */

// GitHub Models API - Thử nhiều endpoint khác nhau
// Lưu ý: Service này có thể không còn hoạt động hoặc endpoint đã thay đổi
const GITHUB_MODELS_ENDPOINTS = [
  "https://models.inference.ai.vespa.party/v1/chat/completions",  // Original endpoint
  "https://inference.ai.vespa.party/v1/chat/completions",  // Alternative domain
  "https://api.github.com/models/v1/chat/completions",  // GitHub official (nếu có)
];

// Fast models available on GitHub Models (optimized for speed < 5s)
const GITHUB_MODELS = [
  "deepseek/deepseek-v3",           // DeepSeek-V3 (fastest, ~1-3s)
  "google/gemini-2.0-flash-exp",    // Gemini 2.0 Flash (very fast, ~2-4s)
  "google/gemini-2.0-flash",         // Gemini 2.0 Flash stable
  "deepseek/deepseek-r1",            // DeepSeek-R1 (fast alternative)
];

export interface GitHubModelsResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Call GitHub Models API with fast models
 */
export async function callGitHubModels(
  prompt: string,
  apiKey: string
): Promise<GitHubModelsResponse> {
  try {
    // Try each endpoint first
    for (const endpoint of GITHUB_MODELS_ENDPOINTS) {
      // Try each model in order (fastest first)
      for (const model of GITHUB_MODELS) {
        try {
          console.log(`Trying GitHub Models endpoint: ${endpoint}, model: ${model}`);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: "user",
                  content: prompt,
                },
              ],
              temperature: 0.7,
              max_tokens: 1500,  // Reduced for faster response
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`GitHub Models API error (${endpoint}, ${model}):`, errorData);
            
            // If it's a rate limit or quota error, try next model
            if (response.status === 429 || response.status === 401 || response.status === 403) {
              console.log(`Model ${model} failed (${response.status}), trying next...`);
              continue;
            }
            
            // For other errors, try next endpoint
            break; // Break inner loop, try next endpoint
          }

          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;

          if (!text) {
            console.error("No text in GitHub Models response:", data);
            continue; // Try next model
          }

          console.log(`✓ Successfully used GitHub Models: ${endpoint}, model: ${model}`);
          return {
            success: true,
            response: text,
          };
        } catch (error: any) {
          // Log chi tiết hơn để debug
          const errorMsg = error?.message || String(error);
          console.error(`Error with endpoint ${endpoint}, model ${model}:`, errorMsg);
          // Nếu là network error (fetch failed), thử endpoint khác
          if (errorMsg.includes("fetch failed") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ENOTFOUND")) {
            console.warn(`⚠ Network error - trying next endpoint...`);
            break; // Break inner loop, try next endpoint
          }
          // Continue to next model
          continue;
        }
      }
    }

    // All models failed
    return {
      success: false,
      error: "All GitHub Models failed",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

