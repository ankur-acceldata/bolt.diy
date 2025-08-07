/**
 * Dynamic LLM Provider Configuration
 *
 * This configuration system allows filtering providers and models without hardcoding.
 * Only Google and Anthropic providers are enabled with their latest 4 versions.
 */

export interface ProviderFilterConfig {
  enabledProviders: string[];
  maxModelsPerProvider: number;
  providerModelLimits: Record<string, ModelFilter>;
}

export interface ModelFilter {
  maxModels: number;
  preferredModels?: string[];
  excludeModels?: string[];
}

/**
 * Current configuration: Only Google and Anthropic with one model from each of the latest 4 versions
 * Excludes image generation, TTS, and other non-text models
 */
export const PROVIDER_FILTER_CONFIG: ProviderFilterConfig = {
  enabledProviders: ['Google', 'Anthropic'],
  maxModelsPerProvider: 4,
  providerModelLimits: {
    Google: {
      maxModels: 4,
      excludeModels: [
        // Exclude older/deprecated versions that might still appear in API
        'gemini-1.0-pro',
        'text-bison',
        'chat-bison',

        // Exclude non-text models
        'gemini-pro-vision',
        'gemini-2.0-flash-preview-image-generation',
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
      ],
    },
    Anthropic: {
      maxModels: 4,
      excludeModels: [
        // Exclude older/deprecated versions that might still appear in API
        'claude-instant',
        'claude-instant-1',
        'claude-1',
        'claude-2',
        'claude-2.0',
        'claude-2.1',
      ],
    },
  },
};

/**
 * Check if a provider is enabled
 */
export function isProviderEnabled(providerName: string): boolean {
  return PROVIDER_FILTER_CONFIG.enabledProviders.includes(providerName);
}

/**
 * Filter and sort models for a specific provider based on configuration
 * This function gets the latest models dynamically from API results
 */
export function filterModelsForProvider(providerName: string, models: any[]): any[] {
  if (!isProviderEnabled(providerName)) {
    return [];
  }

  const providerConfig = PROVIDER_FILTER_CONFIG.providerModelLimits[providerName];
  const maxModels = providerConfig?.maxModels || PROVIDER_FILTER_CONFIG.maxModelsPerProvider;

  let filteredModels = [...models];

  // Exclude specific models if configured
  if (providerConfig?.excludeModels && providerConfig.excludeModels.length > 0) {
    filteredModels = filteredModels.filter((model) => !providerConfig.excludeModels!.includes(model.name));
  }

  // Sort models to get the latest ones first
  filteredModels = sortModelsByLatest(providerName, filteredModels);

  // If preferred models are specified, prioritize them but still respect the sort order
  if (providerConfig?.preferredModels && providerConfig.preferredModels.length > 0) {
    const preferred = filteredModels.filter((model) => providerConfig.preferredModels!.includes(model.name));
    const remaining = filteredModels.filter((model) => !providerConfig.preferredModels!.includes(model.name));
    filteredModels = [...preferred, ...remaining];
  }

  // Limit to max models
  return filteredModels.slice(0, maxModels);
}

/**
 * Sort models by latest versions first
 */
function sortModelsByLatest(providerName: string, models: any[]): any[] {
  // Custom sorting logic for each provider to get the latest models first
  if (providerName === 'Google') {
    return sortGoogleModels(models);
  } else if (providerName === 'Anthropic') {
    return sortAnthropicModels(models);
  }

  // Default: sort by name descending (assuming newer versions have higher names)
  return models.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Sort Google models by version priority (latest first) and filter to one per version
 */
function sortGoogleModels(models: any[]): any[] {
  // Filter out non-text models (image generation, TTS, etc.)
  const textModels = models.filter((model) => {
    const name = model.name.toLowerCase();
    return (
      !name.includes('vision') &&
      !name.includes('image') &&
      !name.includes('tts') &&
      !name.includes('text-to-speech') &&
      !name.includes('imagen') &&
      !name.includes('preview-image') &&
      !name.includes('live') &&
      name.includes('gemini')
    ); // Only Gemini text models
  });

  const versionPriority: Record<string, number> = {
    '2.5': 1000,
    '2.0': 900,
    '1.5': 800,
    '1.0': 700,
    '0': 100, // Default for models without recognized version
  };

  // Group models by version
  const versionGroups: Record<string, any[]> = {};
  textModels.forEach((model) => {
    const version = extractGoogleVersion(model.name);

    if (!versionGroups[version]) {
      versionGroups[version] = [];
    }

    versionGroups[version].push(model);
  });

  // Select best model from each version group
  const selectedModels: any[] = [];
  Object.entries(versionGroups).forEach(([_version, versionModels]) => {
    // Sort models within version by preference (pro > flash > flash-lite)
    const sortedVersionModels = versionModels.sort((a, b) => {
      const aScore = getGoogleModelScore(a.name);
      const bScore = getGoogleModelScore(b.name);

      return bScore - aScore; // Higher score first
    });

    // Take the best model from this version
    selectedModels.push(sortedVersionModels[0]);
  });

  // Sort by version priority
  return selectedModels.sort((a, b) => {
    const aVersion = extractGoogleVersion(a.name);
    const bVersion = extractGoogleVersion(b.name);

    const aPriority = versionPriority[aVersion] || 100;
    const bPriority = versionPriority[bVersion] || 100;

    return bPriority - aPriority; // Higher priority first
  });
}

/**
 * Get preference score for Google models within same version
 */
function getGoogleModelScore(modelName: string): number {
  const name = modelName.toLowerCase();

  if (name.includes('pro')) {
    return 100;
  }

  if (name.includes('flash') && !name.includes('lite')) {
    return 80;
  }

  if (name.includes('flash-lite')) {
    return 60;
  }

  if (name.includes('flash-8b')) {
    return 40;
  }

  return 20;
}

/**
 * Sort Anthropic models by version priority (latest first) and filter to one per version
 */
function sortAnthropicModels(models: any[]): any[] {
  // Filter out non-text models (audio, vision, etc.)
  const textModels = models.filter((model) => {
    const name = model.name.toLowerCase();
    return (
      !name.includes('vision') &&
      !name.includes('audio') &&
      !name.includes('tts') &&
      !name.includes('text-to-speech') &&
      !name.includes('image') &&
      name.includes('claude')
    ); // Only Claude text models
  });

  const versionPriority: Record<string, number> = {
    '3.7': 1000,
    '3.5': 900,
    '3.0': 800,
    '2.0': 700,
    '0': 100, // Default for models without recognized version
  };

  // Group models by version
  const versionGroups: Record<string, any[]> = {};
  textModels.forEach((model) => {
    const version = extractAnthropicVersion(model.name);

    if (!versionGroups[version]) {
      versionGroups[version] = [];
    }

    versionGroups[version].push(model);
  });

  // Select best model from each version group
  const selectedModels: any[] = [];
  Object.entries(versionGroups).forEach(([_version, versionModels]) => {
    // Sort models within version by preference (sonnet > haiku > opus for same version)
    const sortedVersionModels = versionModels.sort((a, b) => {
      const aScore = getAnthropicModelScore(a.name);
      const bScore = getAnthropicModelScore(b.name);

      if (aScore !== bScore) {
        return bScore - aScore; // Higher score first
      }

      // Prefer "latest" versions
      if (a.name.includes('latest') && !b.name.includes('latest')) {
        return -1;
      }

      if (b.name.includes('latest') && !a.name.includes('latest')) {
        return 1;
      }

      // If same score, sort by name descending (newer dates first)
      return b.name.localeCompare(a.name);
    });

    // Take the best model from this version
    selectedModels.push(sortedVersionModels[0]);
  });

  // Sort by version priority
  return selectedModels.sort((a, b) => {
    const aVersion = extractAnthropicVersion(a.name);
    const bVersion = extractAnthropicVersion(b.name);

    const aPriority = versionPriority[aVersion] || 100;
    const bPriority = versionPriority[bVersion] || 100;

    return bPriority - aPriority; // Higher priority first
  });
}

/**
 * Get preference score for Anthropic models within same version
 */
function getAnthropicModelScore(modelName: string): number {
  const name = modelName.toLowerCase();

  if (name.includes('sonnet')) {
    return 100;
  }

  if (name.includes('haiku')) {
    return 80;
  }

  if (name.includes('opus')) {
    return 60;
  }

  return 20;
}

/**
 * Extract version number from Google model name
 */
function extractGoogleVersion(modelName: string): string {
  const match = modelName.match(/gemini-(\d+\.\d+)/);
  return match ? match[1] : '0';
}

/**
 * Extract version number from Anthropic model name
 */
function extractAnthropicVersion(modelName: string): string {
  const match = modelName.match(/claude-(\d+\.\d+)/);
  return match ? match[1] : '0';
}

/**
 * Get filtered provider list
 */
export function getEnabledProviders(allProviders: any[]): any[] {
  return allProviders.filter((provider) => isProviderEnabled(provider.name));
}

/**
 * Environment-based override capability
 * Allows runtime configuration via environment variables
 */
export function getProviderConfigFromEnv(): Partial<ProviderFilterConfig> {
  const envConfig: Partial<ProviderFilterConfig> = {};

  // Allow environment override of enabled providers
  if (typeof process !== 'undefined' && process.env.LLM_ENABLED_PROVIDERS) {
    envConfig.enabledProviders = process.env.LLM_ENABLED_PROVIDERS.split(',').map((p) => p.trim());
  }

  // Allow environment override of max models per provider
  if (typeof process !== 'undefined' && process.env.LLM_MAX_MODELS_PER_PROVIDER) {
    const maxModels = parseInt(process.env.LLM_MAX_MODELS_PER_PROVIDER, 10);

    if (!isNaN(maxModels)) {
      envConfig.maxModelsPerProvider = maxModels;
    }
  }

  return envConfig;
}

/**
 * Get the final configuration with environment overrides applied
 */
export function getFinalProviderConfig(): ProviderFilterConfig {
  const envOverrides = getProviderConfigFromEnv();
  return {
    ...PROVIDER_FILTER_CONFIG,
    ...envOverrides,
  };
}
