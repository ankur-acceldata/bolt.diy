import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects.$id.sessions');

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  try {
    const result = await AcceldataService.getAllSessionsByProjectId(id, request);
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

export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    let sessionData: any;

    try {
      const bodyText = await request.text();

      if (bodyText && bodyText.trim()) {
        sessionData = JSON.parse(bodyText);
        logger.info(`Creating session for project ${id} with data:`, sessionData);
      }
    } catch (parseError) {
      logger.warn('Failed to parse request body:', parseError);
      return json({ error: 'Invalid JSON in request body', success: false }, { status: 400 });
    }

    if (!sessionData) {
      return json({ error: 'Session data is required', success: false }, { status: 400 });
    }

    const result = await AcceldataService.createUserSession(id, sessionData, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Session creation error for project ${id}:`, error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
