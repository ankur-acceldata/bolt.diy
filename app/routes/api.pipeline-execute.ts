import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.pipeline-execute');

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get base URL from HOST environment variable
    const host = (context?.cloudflare?.env as any)?.HOST || process.env.HOST || 'demo.xdp.acceldata.tech';
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    const endpoint = `${baseUrl}/xdp-cp-service/api/pipelines/4/execute`;

    logger.info(`Executing pipeline to: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-User-Name': 'Tanaya',
        'X-Tenant-ID': '1234',
        'X-Tenant-Name': 'TestTenant',
        'X-User-ID': '5678',
        accessKey:
          (context?.cloudflare?.env as any)?.ACCELDATA_ACCESS_KEY ||
          process.env.ACCELDATA_ACCESS_KEY ||
          'ALT6BIHE5NMKBDN',
        secretKey:
          (context?.cloudflare?.env as any)?.ACCELDATA_SECRET_KEY ||
          process.env.ACCELDATA_SECRET_KEY ||
          '3T8QZL5QOZ8KHXSO20OKETW5EI6JPM',
      },
      body: '',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error(`Pipeline execution failed: ${response.status} ${response.statusText}`, { data });
      return json(
        {
          error: `Pipeline execution failed: ${response.status} ${response.statusText}`,
          details: data,
        },
        { status: response.status },
      );
    }

    logger.info('Pipeline executed successfully', { response: data });

    return json({
      success: true,
      status: response.status,
      data,
      message: 'Pipeline executed successfully',
    });
  } catch (error) {
    logger.error('Pipeline execution error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
