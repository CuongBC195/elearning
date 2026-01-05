/**
 * OpenRouter API helper functions
 * Uses DeepSeek models (free tier) via OpenRouter
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// DeepSeek models available on OpenRouter (free tier)
// Note: Model IDs may change, check https://openrouter.ai/models for latest
const DEEPSEEK_MODELS = [
  "deepseek/deepseek-chat",         // DeepSeek Chat (free tier)
  "deepseek/deepseek-coder",        // DeepSeek Coder (free tier)
  "meta-llama/llama-3.2-3b-instruct:free",  // Alternative free model
  "google/gemini-flash-1.5-8b:free",        // Alternative free model
];

export interface OpenRouterResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Call OpenRouter API with DeepSeek models
 */
export async function callOpenRouter(
  prompt: string,
  apiKey: string
): Promise<OpenRouterResponse> {
  try {
    // Try each DeepSeek model in order
    for (const model of DEEPSEEK_MODELS) {
      try {
        const response = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000",
            "X-Title": "3DO Learning Writing",
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
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`OpenRouter API error (${model}):`, errorData);
          
          // If it's a rate limit or quota error, try next model
          if (response.status === 429 || response.status === 402) {
            console.log(`Model ${model} rate limited, trying next...`);
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
          console.error("No text in OpenRouter response:", data);
          continue; // Try next model
        }

        console.log(`✓ Successfully used OpenRouter model: ${model}`);
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
      error: "All DeepSeek models failed on OpenRouter",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error),
    };
  }
}

