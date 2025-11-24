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
 * Current configuration: Google, Anthropic, and AmazonBedrock show up to 5 models (latest versions)
 * For Google: Shows the latest 5 model variants (prioritizing newer versions and capabilities)
 * For Anthropic: Shows the latest 5 model variants (prioritizing newer versions and capabilities)
 * For Anthropic: Ensures the latest 2 Sonnet models are always included
 * For AmazonBedrock: Shows all configured models (static models from provider)
 * Excludes image generation, TTS, and other non-text models for both providers
 * Uses dynamic version priority calculation to automatically handle new model versions
 */
export const PROVIDER_FILTER_CONFIG: ProviderFilterConfig = {
  enabledProviders: ['Google', 'Anthropic', 'AmazonBedrock'],
  maxModelsPerProvider: 5,
  providerModelLimits: {
    Google: {
      maxModels: 5, // Show only the latest 5 models
      excludeModels: [
        // Exclude truly deprecated versions
        'text-bison',
        'chat-bison',

        // Exclude non-text models
        'gemini-pro-vision',
        'gemini-2.0-flash-preview-image-generation',
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
        'gemini-1.0-pro-vision',
      ],
    },
    Anthropic: {
      maxModels: 5, // Show only the latest 5 models
      excludeModels: [
        // Only exclude truly deprecated models
        'claude-instant',
        'claude-instant-1',
        'claude-1',
        'claude-2.0', // Keep claude-2.1 as it might still be useful
      ],
    },
    AmazonBedrock: {
      maxModels: 10, // Show all configured Bedrock models
      excludeModels: [],
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
 * Sort Google models by version and capability, showing all variants
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

  // Dynamic version priority calculation based on version numbers
  const getVersionPriority = (version: string): number => {
    if (version === '0') {
      return 100; // Default for unrecognized versions
    }

    const [major, minor] = version.split('.').map(Number);

    // Calculate priority: major * 1000 + minor * 100 (higher = newer)
    return (major || 0) * 1000 + (minor || 0) * 100;
  };

  // Sort all models by version and capability without limiting to one per version
  return textModels.sort((a, b) => {
    const aVersion = extractGoogleVersion(a.name);
    const bVersion = extractGoogleVersion(b.name);

    const aPriority = getVersionPriority(aVersion);
    const bPriority = getVersionPriority(bVersion);

    // First sort by version (newer first)
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }

    // If same version, sort by model capability score
    const aScore = getGoogleModelScore(a.name);
    const bScore = getGoogleModelScore(b.name);

    if (aScore !== bScore) {
      return bScore - aScore; // Higher score first
    }

    // Prefer experimental/preview versions
    if (a.name.includes('experimental') && !b.name.includes('experimental')) {
      return -1;
    }

    if (b.name.includes('experimental') && !a.name.includes('experimental')) {
      return 1;
    }

    // Finally, sort by name descending (newer dates/versions first)
    return b.name.localeCompare(a.name);
  });
}

/**
 * Get preference score for Google models within same version
 * Higher scores indicate more capable/preferred models
 */
function getGoogleModelScore(modelName: string): number {
  const name = modelName.toLowerCase();

  // Latest and most capable models get highest scores
  if (name.includes('ultra')) {
    return 120; // Most capable when available
  }

  if (name.includes('pro')) {
    return 100; // High capability, balanced performance
  }

  if (name.includes('flash') && !name.includes('lite') && !name.includes('8b')) {
    return 80; // Fast and capable
  }

  if (name.includes('flash-lite')) {
    return 60; // Lightweight version
  }

  if (name.includes('flash-8b')) {
    return 40; // Smallest model
  }

  if (name.includes('nano')) {
    return 30; // Edge/mobile optimized
  }

  // Handle any other variants
  return 50;
}

/**
 * Sort Anthropic models by creation date (latest first)
 * Ensures the latest 2 Sonnet models are prioritized
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

  // Separate Sonnet models from other models
  const sonnetModels = textModels.filter((model) => model.name.toLowerCase().includes('sonnet'));
  const otherModels = textModels.filter((model) => !model.name.toLowerCase().includes('sonnet'));

  // Sort function for models by creation date
  const sortByDate = (a: any, b: any) => {
    // If both have createdAt timestamps, use those (most reliable)
    if (a.createdAt && b.createdAt) {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();

      return bDate - aDate; // Newer first
    }

    // Fallback: if one has createdAt and the other doesn't, prioritize the one with createdAt
    if (a.createdAt && !b.createdAt) {
      return -1;
    }

    if (!a.createdAt && b.createdAt) {
      return 1;
    }

    // Fallback: Extract date from model name (format: YYYYMMDD)
    const extractDate = (modelName: string): number => {
      const dateMatch = modelName.match(/(\d{8})/);

      if (dateMatch) {
        return parseInt(dateMatch[1], 10);
      }

      return 0;
    };

    const aDate = extractDate(a.name);
    const bDate = extractDate(b.name);

    if (aDate !== bDate) {
      return bDate - aDate;
    }

    // Final fallback: sort by name
    return b.name.localeCompare(a.name);
  };

  // Sort both arrays by date
  const sortedSonnetModels = sonnetModels.sort(sortByDate);
  const sortedOtherModels = otherModels.sort(sortByDate);

  // Get the latest 2 Sonnet models
  const latestSonnetModels = sortedSonnetModels.slice(0, 2);

  /*
   * Combine: latest 2 Sonnet models first, then other models
   * The filterModelsForProvider function will apply the maxModels limit
   */
  return [...latestSonnetModels, ...sortedOtherModels];
}

/**
 * Extract version number from Google model name
 */
function extractGoogleVersion(modelName: string): string {
  const match = modelName.match(/gemini-(\d+\.\d+)/);
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
