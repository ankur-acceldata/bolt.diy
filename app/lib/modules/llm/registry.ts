/**
 * LLM Provider Registry
 *
 * This registry is configured to only load Google and Anthropic providers
 * with their latest 4 model versions each, as per the current requirements.
 *
 * To enable other providers, add them back to the imports and exports below.
 */

import AnthropicProvider from './providers/anthropic';
import GoogleProvider from './providers/google';

/*
 * Commented out unused providers - uncomment to re-enable
 * import CohereProvider from './providers/cohere';
 * import DeepseekProvider from './providers/deepseek';
 * import GroqProvider from './providers/groq';
 * import HuggingFaceProvider from './providers/huggingface';
 * import LMStudioProvider from './providers/lmstudio';
 * import MistralProvider from './providers/mistral';
 * import OllamaProvider from './providers/ollama';
 * import OpenRouterProvider from './providers/open-router';
 * import OpenAILikeProvider from './providers/openai-like';
 * import OpenAIProvider from './providers/openai';
 * import PerplexityProvider from './providers/perplexity';
 * import TogetherProvider from './providers/together';
 * import XAIProvider from './providers/xai';
 * import HyperbolicProvider from './providers/hyperbolic';
 * import AmazonBedrockProvider from './providers/amazon-bedrock';
 * import GithubProvider from './providers/github';
 */

export {
  AnthropicProvider,
  GoogleProvider,

  /*
   * Commented out unused providers - uncomment to re-enable
   * CohereProvider,
   * DeepseekProvider,
   * GroqProvider,
   * HuggingFaceProvider,
   * HyperbolicProvider,
   * MistralProvider,
   * OllamaProvider,
   * OpenAIProvider,
   * OpenRouterProvider,
   * OpenAILikeProvider,
   * PerplexityProvider,
   * XAIProvider,
   * TogetherProvider,
   * LMStudioProvider,
   * AmazonBedrockProvider,
   * GithubProvider,
   */
};
