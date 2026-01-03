/**
 * GitHub Models API helper functions
 * Uses DeepSeek-V3 and Gemini 2.0 Flash (fast models < 5s)
 */

// GitHub Models API - có thể là một trong các endpoint sau
// Thử các endpoint phổ biến cho GitHub Models
const GITHUB_MODELS_ENDPOINTS = [
  "https://api.github.com/models/v1/chat/completions",  // GitHub Models official (nếu có)
  "https://models.inference.ai.vespa.party/v1/chat/completions",  // Alternative endpoint
  "https://api.github.com/copilot/models/v1/chat/completions",  // GitHub Copilot Models
];

const GITHUB_MODELS_API_URL = GITHUB_MODELS_ENDPOINTS[1]; // Default to vespa.party

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
    // Try each model in order (fastest first)
    for (const model of GITHUB_MODELS) {
      try {
        const response = await fetch(GITHUB_MODELS_API_URL, {
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
          console.error(`GitHub Models API error (${model}):`, errorData);
          
          // If it's a rate limit or quota error, try next model
          if (response.status === 429 || response.status === 401 || response.status === 403) {
            console.log(`Model ${model} failed (${response.status}), trying next...`);
            continue;
          }
          
          return {
            success: false,
            error: errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
          console.error("No text in GitHub Models response:", data);
          continue; // Try next model
        }

        console.log(`✓ Successfully used GitHub Models: ${model}`);
        return {
          success: true,
          response: text,
        };
      } catch (error: any) {
        // Log chi tiết hơn để debug
        const errorMsg = error?.message || String(error);
        console.error(`Error with model ${model}:`, errorMsg);
        // Nếu là network error (fetch failed), có thể endpoint không đúng
        if (errorMsg.includes("fetch failed") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("ENOTFOUND")) {
          console.warn(`⚠ Network error with ${model} - endpoint may be incorrect or service unavailable`);
        }
        // Continue to next model
        continue;
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

