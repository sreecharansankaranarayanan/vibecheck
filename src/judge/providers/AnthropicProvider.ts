import OpenAI from "openai";
import { LLMProvider, LLMProviderConfig } from "../types";

/**
 * Anthropic provider using their OpenAI-compatible endpoint.
 *
 * SECURITY (LOW-5): The original ProviderFactory used the vanilla OpenAIProvider
 * against Anthropic's API, which sends `Authorization: Bearer` but not the
 * required `x-api-key` and `anthropic-version` headers. This dedicated provider
 * sets both, ensuring the request is well-formed and authenticated correctly.
 *
 * Reference: https://docs.anthropic.com/en/api/openai-sdk-compatibility
 */
export class AnthropicProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || "https://api.anthropic.com/v1",
      defaultHeaders: {
        // Anthropic requires both the standard Bearer token AND these headers
        // when using the OpenAI-compatible endpoint.
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
  }

  async complete(
    systemPrompt: string,
    userMessage: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const response = await this.client.chat.completions.create(
      {
        model: this.config.model,
        temperature: this.config.temperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      },
      { signal },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Anthropic Judge returned empty response");
    }
    return content;
  }
}
