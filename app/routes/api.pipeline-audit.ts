import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.pipeline-audit');

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { runId } = (await request.json()) as { runId?: string | number };

    if (!runId) {
      return json({ error: 'Missing runId' }, { status: 400 });
    }

    // Use centralized service with request for dynamic base URL
    const result = await AcceldataService.getPipelineAudit(runId, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error('Pipeline audit error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
