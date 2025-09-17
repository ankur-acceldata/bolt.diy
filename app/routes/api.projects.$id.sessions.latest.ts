import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects.$id.sessions.latest');

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  try {
    const result = await AcceldataService.getLatestSessionForProjectId(id, request);
    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Error fetching latest session for project ${id}:`, error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
