import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export default class GoogleProvider extends BaseProvider {
  name = 'Google';
  getApiKeyLink = 'https://aistudio.google.com/app/apikey';

  config = {
    apiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      headers: {
        ['Content-Type']: 'application/json',
      },
    });

    const res = (await response.json()) as any;

    const data = res.models.filter((model: any) => {
      // Filter out models with experimental or preview in name or displayName
      const modelName = model.name.toLowerCase();
      const displayName = model.displayName.toLowerCase();

      const isExperimentalOrPreview =
        modelName.includes('experimental') ||
        modelName.includes('preview') ||
        displayName.includes('experimental') ||
        displayName.includes('preview');

      return model.outputTokenLimit > 8000 && !isExperimentalOrPreview;
    });

    return data.map((m: any) => ({
      name: m.name.replace('models/', ''),
      label: `${m.displayName} - context ${Math.floor((m.inputTokenLimit + m.outputTokenLimit) / 1000) + 'k'}`,
      provider: this.name,
      maxTokenAllowed: m.inputTokenLimit + m.outputTokenLimit || 8000,
    }));
  }

  getModelInstance(options: {
    model: string;
    serverEnv: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    /*
     * IMPORTANT: Preview models like gemini-2.5-pro-preview-06-05 may have compatibility issues
     * with the current AI SDK version. If you encounter "Type validation failed" errors,
     * consider using stable models like gemini-1.5-pro or gemini-1.5-flash instead.
     */
    if (model.includes('preview')) {
      console.warn(
        `Warning: Using preview model ${model} which may have compatibility issues with AI SDK. Consider using gemini-1.5-pro or gemini-1.5-flash for better stability.`,
      );
    }

    return google(model);
  }
}
