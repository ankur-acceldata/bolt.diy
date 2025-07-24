import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.adhoc-run');

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Get base URL from HOST environment variable
    const host = (context?.cloudflare?.env as any)?.HOST || process.env.HOST || 'demo.xdp.acceldata.tech';

    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    const adhocRunConfig = {
      config: {
        adhocRunType: 'SPARK_PYTHON_ADHOC_RUN',
        image: 'docker.io/apache/spark:4.0.0',
        codeSource: {
          type: 'MINIO',
          config: {
            url: 'applications/python-spark-app',
          },
        },
        stages: [
          'pip install -r requirements.txt --no-cache-dir',
          'python3 success_test.py',
          "echo 'Execution completed successfully'",
        ],
        type: 'Python',
        mode: 'cluster',
      },
      dataplaneName: 'xdp-dataplane',
    };

    const endpoint = `${baseUrl}/xdp-cp-service/api/adhoc-runs`;

    logger.info(`Executing adhoc run to: ${endpoint}`);
    logger.info('Request payload:', { adhocRunConfig });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-User-Name': 'Tanaya',
        'X-Tenant-ID': '1234',
        'X-Tenant-Name': 'TestTenant',
        'X-User-ID': '5678',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(context?.cloudflare?.env as any)?.ACCELDATA_ACCESS_KEY || process.env.ACCELDATA_ACCESS_KEY || 'P8V8WI8JO9G7Z5W'}`,
      },
      body: JSON.stringify(adhocRunConfig),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      logger.error(`Adhoc run execution failed: ${response.status} ${response.statusText}`, { data });
      return json(
        {
          error: `Execution failed: ${response.status} ${response.statusText}`,
          details: data,
        },
        { status: response.status },
      );
    }

    logger.info('Adhoc run executed successfully', { runId: (data as any)?.id });

    return json({
      success: true,
      status: response.status,
      data,
      message: 'Adhoc run executed successfully',
    });
  } catch (error) {
    logger.error('Adhoc run execution error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
