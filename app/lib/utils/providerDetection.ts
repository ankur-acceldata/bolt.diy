import type { ProviderInfo } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ProviderDetection');

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
     */
    const checkPromises = providerList.map(async (provider) => {
      const isConfigured = await isProviderConfigured(provider.name);

      if (isConfigured) {
        logger.info(`Detected configured provider: ${provider.name}`);
        return provider;
      }

      return null;
    });

    const results = await Promise.all(checkPromises);
    configuredProviders.push(...results.filter((p): p is ProviderInfo => p !== null));

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
    logger.error('Failed to detect configured provider:', error);
    return { provider: null, hasMultipleProviders: false };
  }
}

/**
 * Checks if a specific provider has an API key configured
 * Uses the existing check-env-key API endpoint
 */
export async function isProviderConfigured(providerName: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/check-env-key?provider=${encodeURIComponent(providerName)}`);
    const data = await response.json();

    return (data as { isSet: boolean }).isSet;
  } catch (error) {
    logger.error(`Failed to check if provider ${providerName} is configured:`, error);
    return false;
  }
}
