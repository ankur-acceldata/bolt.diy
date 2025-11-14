import type { LoaderFunction } from '@remix-run/cloudflare';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

/**
 * API endpoint to detect all configured providers in a single call
 * Returns a list of provider names that have API keys configured
 * More efficient than checking each provider individually
 */
export const loader: LoaderFunction = async ({ context, request }) => {
  const llmManager = LLMManager.getInstance(context?.cloudflare?.env as any);
  const providers = llmManager.getAllProviders();

  // Get API keys from cookie
  const cookieHeader = request.headers.get('Cookie');
  const apiKeysFromCookie = getApiKeysFromCookie(cookieHeader);

  const configuredProviders: string[] = [];

  // Check each provider
  for (const provider of providers) {
    if (!provider.config.apiTokenKey) {
      continue;
    }

    const envVarName = provider.config.apiTokenKey;

    // Check if this provider has an API key from any source
    const hasKey = !!(
      apiKeysFromCookie?.[provider.name] ||
      (context?.cloudflare?.env as Record<string, any>)?.[envVarName] ||
      process.env[envVarName] ||
      llmManager.env[envVarName]
    );

    if (hasKey) {
      configuredProviders.push(provider.name);
    }
  }

  return Response.json({
    configuredProviders,
    count: configuredProviders.length,
  });
};
