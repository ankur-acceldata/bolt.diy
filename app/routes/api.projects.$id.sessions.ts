import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects.$id.sessions');

/**
 * GET /api/projects/:id/sessions
 * Fetch all sessions for a project
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  try {
    logger.info(`Fetching sessions for project ${id}`);

    const result = await AcceldataService.getProjectSessions(id, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Error fetching sessions for project ${id}:`, error);

    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/:id/sessions
 * Create a new session for a project
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  // Only handle POST requests (PUT is handled by separate route)
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed', success: false }, { status: 405 });
  }

  try {
    const sessionData = await request.json();

    logger.info(`Creating new session for project ${id}`);

    const result = await AcceldataService.createOrUpdateSession(id, sessionData, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Error creating session for project ${id}:`, error);

    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
