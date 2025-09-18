import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.projects');

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const result = await AcceldataService.getAllProjects(request);
    return json(result, { status: result.status });
  } catch (error) {
    logger.error('Error fetching projects:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    let projectData: any;

    try {
      const bodyText = await request.text();

      if (bodyText && bodyText.trim()) {
        projectData = JSON.parse(bodyText);
        logger.info('Creating project with data:', projectData);
      }
    } catch (parseError) {
      logger.warn('Failed to parse request body:', parseError);
      return json({ error: 'Invalid JSON in request body', success: false }, { status: 400 });
    }

    if (!projectData) {
      return json({ error: 'Project data is required', success: false }, { status: 400 });
    }

    const result = await AcceldataService.createProject(projectData, request);

    return json(result, { status: result.status });
  } catch (error) {
    logger.error('Project creation error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
