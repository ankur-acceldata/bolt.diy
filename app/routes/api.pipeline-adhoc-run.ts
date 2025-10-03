import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.pipeline-adhoc-run');

export async function action({ request }: ActionFunctionArgs) {
  logger.info('🔧 Pipeline adhoc run API called');

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Parse request body for pipeline configuration
    let pipelineConfig: any | undefined;

    try {
      const bodyText = await request.text();
      logger.info('🔧 Received request body:', bodyText);

      if (bodyText && bodyText.trim()) {
        pipelineConfig = JSON.parse(bodyText);
        logger.info('🔧 Parsed pipeline adhoc run configuration:', pipelineConfig);
      }
    } catch (parseError) {
      logger.warn('Failed to parse request body:', parseError);
    }

    if (!pipelineConfig) {
      return json(
        {
          error: 'Pipeline configuration is required',
          success: false,
        },
        { status: 400 },
      );
    }

    // Use centralized service with request for dynamic base URL
    logger.info('🔧 Calling AcceldataService.executePipelineAdhocRun');

    const result = await AcceldataService.executePipelineAdhocRun(pipelineConfig, request);

    logger.info('🔧 AcceldataService result:', JSON.stringify(result, null, 2));

    return json(result, { status: result.status });
  } catch (error) {
    logger.error('Pipeline adhoc run execution error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
