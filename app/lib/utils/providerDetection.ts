import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ProviderDetection');

// Timeout for provider configuration checks (in ms)
const PROVIDER_CHECK_TIMEOUT = 5000;

/**
 * Detects which providers are configured via environment variables
 * Makes a SINGLE API call to check all providers at once (efficient!)
 * Returns the provider info if found, null otherwise
 */
export async function detectConfiguredProvider(providerList: ProviderInfo[]): Promise<{
  provider: ProviderInfo | null;
  hasMultipleProviders: boolean;
}> {
  try {
    // Make ONE API call to check all providers at once
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CHECK_TIMEOUT);

    const response = await fetch('/api/detect-configured-providers', {
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('Failed to detect configured providers:', response.status);
      return { provider: null, hasMultipleProviders: false };
    }

    const data = (await response.json()) as {
      configuredProviders: string[];
      count: number;
    };

    logger.info(`Detected ${data.count} configured provider(s):`, data.configuredProviders);

    // Find the provider objects from the list
    const configuredProviders = providerList.filter((p) => data.configuredProviders.includes(p.name));

    if (configuredProviders.length === 0) {
      return { provider: null, hasMultipleProviders: false };
    }

    return {
      provider: configuredProviders[0],
      hasMultipleProviders: configuredProviders.length > 1,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Provider detection timed out');
    } else {
      logger.warn('Provider detection failed:', error);
    }

    return { provider: null, hasMultipleProviders: false };
  }
}

/**
 * Checks if a specific provider has an API key configured
 * Uses the existing check-env-key API endpoint
 * Note: For checking multiple providers, use detectConfiguredProvider() instead (more efficient)
 */
export async function isProviderConfigured(providerName: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_CHECK_TIMEOUT);

    const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(providerName)}`, {
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    return (data as { isSet: boolean }).isSet;
  } catch {
    return false;
  }
}
