import type { LoaderFunction } from '@remix-run/cloudflare';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.check-env-key');

export const loader: LoaderFunction = async ({ context, request }) => {
  try {
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider');

    logger.debug(`Request received for provider: ${provider}`);

    if (!provider) {
      logger.debug('No provider specified');
      return Response.json({ isSet: false });
    }

    const llmManager = LLMManager.getInstance(context?.cloudflare?.env as any);
    const providerInstance = llmManager.getProvider(provider);

    if (!providerInstance || !providerInstance.config.apiTokenKey) {
      logger.debug(`Provider ${provider} not found or no apiTokenKey configured`);
      return Response.json({ isSet: false });
    }

    const envVarName = providerInstance.config.apiTokenKey;
    logger.debug(`Looking for ${provider} with env var: ${envVarName}`);

    // Get API keys from cookie
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);

    /*
     * Check API key in order of precedence:
     * 1. Client-side API keys (from cookies)
     * 2. Server environment variables (from Cloudflare env)
     * 3. Process environment variables (from .env.local)
     * 4. LLMManager environment variables
     */
    const foundInCookie = !!(apiKeys?.[provider]);
    const foundInCloudflare = !!((context?.cloudflare?.env as Record<string, any>)?.[envVarName]);
    const foundInProcess = !!(process.env[envVarName]);
    const foundInLLMManager = !!(llmManager.env[envVarName]);

    const isSet = foundInCookie || foundInCloudflare || foundInProcess || foundInLLMManager;

    logger.info(`Provider ${provider} check: isSet=${isSet} (cookie=${foundInCookie}, cloudflare=${foundInCloudflare}, process=${foundInProcess}, llmMgr=${foundInLLMManager})`);

    return Response.json({ isSet });
  } catch (error) {
    logger.error('Error in check-env-key endpoint:', error);
    return Response.json({ isSet: false, error: 'Internal error' }, { status: 500 });
  }
};
