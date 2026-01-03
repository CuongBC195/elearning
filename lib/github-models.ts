/**
 * GitHub Models API helper functions
 * Uses DeepSeek-V3 and Gemini 2.0 Flash (fast models < 5s)
 */

const GITHUB_MODELS_API_URL = "https://models.inference.ai.vespa.party/v1/chat/completions";

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
        console.error(`Error with model ${model}:`, error?.message || error);
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

