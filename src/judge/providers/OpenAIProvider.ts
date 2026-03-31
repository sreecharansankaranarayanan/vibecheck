import OpenAI from "openai";
import { LLMProvider, LLMProviderConfig } from "../types";

export class OpenAIProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
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
      throw new Error("Judge returned empty response");
    }
    return content;
  }
}
