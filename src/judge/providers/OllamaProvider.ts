import OpenAI from "openai";
import { LLMProvider, LLMProviderConfig } from "../types";

/**
 * Ollama uses an OpenAI-compatible API, so we reuse the OpenAI SDK
 * with a custom baseURL pointing to the local Ollama instance.
 */
export class OllamaProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    const baseURL = config.baseUrl || "http://localhost:11434/v1";
    this.client = new OpenAI({
      apiKey: "ollama", // Ollama does not require a real key
      baseURL,
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
      throw new Error("Ollama Judge returned empty response");
    }
    return content;
  }
}
