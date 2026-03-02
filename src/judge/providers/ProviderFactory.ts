import { JudgeProvider } from '../../config/ConfigService';
import { LLMProvider, LLMProviderConfig } from '../types';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OllamaProvider } from './OllamaProvider';

export function createProvider(providerType: JudgeProvider, config: LLMProviderConfig): LLMProvider {
  switch (providerType) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      // SECURITY (LOW-5): Use dedicated AnthropicProvider that sets the
      // required x-api-key and anthropic-version headers. The original
      // OpenAIProvider omits these and would fail authentication silently.
      return new AnthropicProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    default: {
      const exhaustive: never = providerType;
      throw new Error(`Unknown judge provider: ${exhaustive}`);
    }
  }
}
