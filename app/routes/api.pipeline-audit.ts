import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.pipeline-audit');

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { runId } = (await request.json()) as { runId?: string | number };

    if (!runId) {
      return json({ error: 'Missing runId' }, { status: 400 });
    }

    // Get base URL from HOST environment variable
    const host = (context?.cloudflare?.env as any)?.HOST || process.env.HOST || 'demo.xdp.acceldata.tech';
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    const endpoint = `${baseUrl}/xdp-cp-service/api/pipelines/runs/${runId}/audit`;

    logger.info(`Fetching audit for run ${runId} from: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'X-User-Name': 'Tanaya',
        'X-Tenant-ID': '1234',
        'X-Tenant-Name': 'TestTenant',
        'X-User-ID': '5678',
        accessKey: (context?.cloudflare?.env as any)?.ACCELDATA_ACCESS_KEY || process.env.ACCELDATA_ACCESS_KEY,
        secretKey: (context?.cloudflare?.env as any)?.ACCELDATA_SECRET_KEY || process.env.ACCELDATA_SECRET_KEY,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error(`Pipeline audit failed: ${response.status} ${response.statusText}`, { data });
      return json(
        {
          error: `Pipeline audit failed: ${response.status} ${response.statusText}`,
          details: data,
        },
        { status: response.status },
      );
    }

    logger.info('Pipeline audit fetched successfully', { runId, dataSize: JSON.stringify(data).length });

    return json({
      success: true,
      status: response.status,
      data,
      message: `Audit for run ${runId} fetched successfully`,
    });
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
