/**
 * GitHub Models API helper functions
 * Official endpoint: https://models.inference.ai.azure.com
 * Docs: https://docs.github.com/en/github-models
 */

// GitHub Models API - Azure inference endpoint
const GITHUB_MODELS_ENDPOINT = "https://models.inference.ai.azure.com/chat/completions";

// Models available on GitHub Models (free tier with Copilot Pro)
// Model names WITHOUT prefix (not "openai/gpt-4o-mini", just "gpt-4o-mini")
const GITHUB_MODELS = [
  "gpt-4o-mini",           // GPT-4o mini (fast, good quality)
  "gpt-4o",                // GPT-4o (better quality)
  "Meta-Llama-3.1-8B-Instruct",  // Llama 3.1 8B
  "Mistral-small",         // Mistral Small
];

export interface GitHubModelsResponse {
  success: boolean;
  response?: string;
  error?: string;
}

/**
 * Call GitHub Models API with multiple keys support
 */
export async function callGitHubModels(
  prompt: string,
  apiKeys: string[]  // Now accepts array of keys
): Promise<GitHubModelsResponse> {
  // Try each API key
  for (const apiKey of apiKeys) {
    // Try each model in order
    for (const model of GITHUB_MODELS) {
      try {
        console.log(`Trying GitHub Models: ${model}`);
        const response = await fetch(GITHUB_MODELS_ENDPOINT, {
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
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(`GitHub Models API error (${model}):`, response.status, errorData);
          
          // If rate limit, try next key
          if (response.status === 429) {
            console.log(`Key rate limited, trying next key...`);
            break; // Break to try next key
          }
          // If auth error, try next key
          if (response.status === 401 || response.status === 403) {
            console.log(`Key auth failed, trying next key...`);
            break;
          }
          continue; // Try next model
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
          console.error("No text in GitHub Models response:", data);
          continue;
        }

        console.log(`✓ Successfully used GitHub Models: ${model}`);
        return {
          success: true,
          response: text,
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error(`Error with model ${model}:`, errorMsg);
        continue;
      }
    }
  }

  // All keys/models failed
  return {
    success: false,
    error: "All GitHub Models failed",
  };
}

