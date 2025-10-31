import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ProviderDetection');

// Timeout for provider configuration checks (in ms)
const PROVIDER_CHECK_TIMEOUT = 5000;

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(url: string, timeout: number = PROVIDER_CHECK_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Detects which providers are configured via environment variables
 * Checks both client-side (import.meta.env) and server-side (via API) sources
 * Returns the provider info if found, null otherwise
 */
export async function detectConfiguredProvider(providerList: ProviderInfo[]): Promise<{
  provider: ProviderInfo | null;
  hasMultipleProviders: boolean;
}> {
  try {
    const configuredProviders: ProviderInfo[] = [];

    /*
     * Check each provider in the list using the check-env-key API
     * This API only returns boolean, not the actual keys (more secure)
     * Use Promise.allSettled to prevent one failure from blocking all checks
     */
    const checkPromises = providerList.map(async (provider) => {
      try {
        const isConfigured = await isProviderConfigured(provider.name);

        if (isConfigured) {
          logger.info(`Detected configured provider: ${provider.name}`);
          return provider;
        }
      } catch (error) {
        // Individual provider check failed - log but continue
        logger.warn(`Provider check failed for ${provider.name}:`, error);
      }

      return null;
    });

    const results = await Promise.allSettled(checkPromises);
    
    // Extract successful results
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        configuredProviders.push(result.value);
      }
    });

    // Return the first configured provider
    if (configuredProviders.length === 0) {
      logger.info('No configured provider detected');
      return { provider: null, hasMultipleProviders: false };
    }

    logger.info(
      `Found ${configuredProviders.length} configured provider(s):`,
      configuredProviders.map((p) => p.name),
    );

    return {
      provider: configuredProviders[0],
      hasMultipleProviders: configuredProviders.length > 1,
    };
  } catch (error) {
    logger.warn('Failed to detect configured provider (falling back to no provider):', error);
    return { provider: null, hasMultipleProviders: false };
  }
}

/**
 * Checks if a specific provider has an API key configured
 * Uses the existing check-env-key API endpoint with timeout
 */
export async function isProviderConfigured(providerName: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`/api/check-env-key?provider=${encodeURIComponent(providerName)}`);
    
    // Check if response is ok before parsing JSON
    if (!response.ok) {
      logger.warn(`Provider check returned ${response.status} for ${providerName}`);
      return false;
    }
    
    const data = await response.json();
    return (data as { isSet: boolean }).isSet;
  } catch (error) {
    // Network errors, timeout, or JSON parsing errors - fail gracefully
    if ((error as Error).name === 'AbortError') {
      logger.warn(`Provider check timed out for ${providerName} (falling back to false)`);
    } else {
      logger.warn(`Failed to check if provider ${providerName} is configured (falling back to false):`, error);
    }
    return false;
  }
}
