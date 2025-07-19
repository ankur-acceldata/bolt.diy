import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { runId } = (await request.json()) as { runId?: string | number };

    if (!runId) {
      return json({ error: 'Missing runId' }, { status: 400 });
    }

    const response = await fetch(`https://demo.xdp.acceldata.tech/xdp-cp-service/api/pipelines/runs/${runId}/audit`, {
      method: 'GET',
      headers: {
        'X-User-Name': 'Tanaya',
        'X-Tenant-ID': '1234',
        'X-Tenant-Name': 'TestTenant',
        'X-User-ID': '5678',
        accessKey: 'ALT6BIHE5NMKBDN',
        secretKey: '3T8QZL5QOZ8KHXSO20OKETW5EI6JPM',
      },
    });
    const data = await response.json().catch(() => ({}));

    return json({ status: response.status, data });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
