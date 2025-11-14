import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects.$id.sessions.$sessionId');

/**
 * PUT /api/projects/:id/sessions/:sessionId
 * Update an existing session
 */
export async function action({ request, params }: ActionFunctionArgs) {
  const { id, sessionId } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  if (!sessionId) {
    return json({ error: 'Session ID is required', success: false }, { status: 400 });
  }

  // Only handle PUT requests
  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed', success: false }, { status: 405 });
  }

  try {
    const sessionData = (await request.json()) as Record<string, any>;

    logger.info(`Updating session ${sessionId} for project ${id}`);
    logger.info('Session data payload:', JSON.stringify(sessionData, null, 2));

    // Log the equivalent curl command
    const headers = Object.fromEntries(request.headers.entries());
    const curlHeaders = Object.entries(headers)
      .filter(([key]) => !key.toLowerCase().startsWith('cf-') && key.toLowerCase() !== 'host')
      .map(([key, value]) => `-H '${key}: ${value}'`)
      .join(' \\\n  ');

    const payloadWithId = { ...sessionData, id: Number(sessionId) };
    const curlCommand = `curl '${new URL(request.url).origin}/api/projects/${id}/sessions/${sessionId}' \\
  -X 'PUT' \\
  ${curlHeaders} \\
  --data-raw '${JSON.stringify(payloadWithId)}'`;

    logger.info('Equivalent curl command:\n' + curlCommand);

    // Use the same service method but with id in the data (not sessionId)
    const result = await AcceldataService.createOrUpdateSession(id, payloadWithId, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Error updating session ${sessionId} for project ${id}:`, error);

    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
