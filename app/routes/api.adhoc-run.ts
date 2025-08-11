import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.adhoc-run');

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Parse request body for configuration
    let adhocRunConfig;

    try {
      const bodyText = await request.text();

      if (bodyText && bodyText.trim()) {
        adhocRunConfig = JSON.parse(bodyText);
        logger.info('Using provided adhoc run configuration:', adhocRunConfig);
      }
    } catch (parseError) {
      logger.warn('Failed to parse request body:', parseError);
    }

    // Use centralized service with request for dynamic base URL
    const result = await AcceldataService.executeAdhocRun(adhocRunConfig, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error('Adhoc run execution error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
