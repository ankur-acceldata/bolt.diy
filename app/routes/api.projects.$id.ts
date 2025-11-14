import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects.$id');

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;

  if (!id) {
    return json({ error: 'Project ID is required', success: false }, { status: 400 });
  }

  try {
    const result = await AcceldataService.getProjectById(id, request);
    return json(result, { status: result.status });
  } catch (error) {
    logger.error(`Error fetching project ${id}:`, error);
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

  // Handle DELETE request
  if (request.method === 'DELETE') {
    try {
      const url = new URL(request.url);
      const deletePipelines = url.searchParams.get('deletePipelines') === 'true';

      logger.info(`Deleting project ${id} (deletePipelines: ${deletePipelines})`);

      const result = await AcceldataService.deleteProject(id, deletePipelines, request);

      return json(result, { status: result.status });
    } catch (error) {
      logger.error(`Project ${id} delete error:`, error);
      return json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        },
        { status: 500 },
      );
    }
  }

  // Handle PUT request
  if (request.method === 'PUT') {
    try {
      let projectData: any;

      try {
        const bodyText = await request.text();

        if (bodyText && bodyText.trim()) {
          projectData = JSON.parse(bodyText);
          logger.info(`Updating project ${id} with data:`, projectData);
        }
      } catch (parseError) {
        logger.warn('Failed to parse request body:', parseError);
        return json({ error: 'Invalid JSON in request body', success: false }, { status: 400 });
      }

      if (!projectData) {
        return json({ error: 'Project data is required', success: false }, { status: 400 });
      }

      const result = await AcceldataService.updateProject(id, projectData, request);

      return json(result, { status: result.status });
    } catch (error) {
      logger.error(`Project ${id} update error:`, error);
      return json(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
        },
        { status: 500 },
      );
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}
