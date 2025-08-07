/**
 * API route for managing Fern-FS sync operations
 * Serves as a proxy to the Golang API server and provides sync status information
 */

import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('FernSyncAPI');

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;
  const serverUrl =
    (formData.get('serverUrl') as string) ||
    (process.env.NODE_ENV === 'production' ? 'http://ad-fern-fs:80' : 'http://localhost:8080');

  try {
    switch (action) {
      case 'check-server':
        return await checkServerHealth(serverUrl);

      case 'get-files':
        return await getFiles(serverUrl);

      case 'save-file': {
        const path = formData.get('path') as string;
        const content = formData.get('content') as string;

        return await saveFile(serverUrl, path, content);
      }

      case 'get-manifest':
        return await getManifest(serverUrl);

      default:
        return json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Fern sync API error:', error);
    return json({ error: (error as Error).message }, { status: 500 });
  }
}

async function checkServerHealth(serverUrl: string) {
  try {
    const response = await fetch(`${serverUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return json({
        available: true,
        status: 'healthy',
        data,
      });
    } else {
      return json({
        available: false,
        status: 'unhealthy',
        error: `Server responded with ${response.status}: ${response.statusText}`,
      });
    }
  } catch (error) {
    return json({
      available: false,
      status: 'unavailable',
      error: (error as Error).message,
    });
  }
}

async function getFiles(serverUrl: string) {
  try {
    const response = await fetch(`${serverUrl}/api/files`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to get files: ${response.statusText}`);
    }

    const data = (await response.json()) as { files?: any[] };

    return json({
      success: true,
      files: data.files || [],
      totalFiles: data.files?.length || 0,
    });
  } catch (error) {
    return json({
      success: false,
      error: (error as Error).message,
    });
  }
}

async function saveFile(serverUrl: string, path: string, content: string) {
  try {
    const response = await fetch(`${serverUrl}/api/files/${encodeURIComponent(path)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        path,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout for file operations
    });

    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.statusText}`);
    }

    return json({
      success: true,
      path,
      message: 'File saved successfully',
    });
  } catch (error) {
    return json({
      success: false,
      error: (error as Error).message,
      path,
    });
  }
}

async function getManifest(serverUrl: string) {
  try {
    const response = await fetch(`${serverUrl}/api/sync/manifest`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to get manifest: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return json({
      success: true,
      manifest: data,
    });
  } catch (error) {
    return json({
      success: false,
      error: (error as Error).message,
    });
  }
}

export async function loader() {
  // GET request - return API documentation
  return json({
    name: 'Fern-FS Sync API Proxy',
    description: 'Proxy API for communicating with the Golang Fern-FS server',
    endpoints: {
      'POST /api/fern-sync': {
        actions: [
          {
            action: 'check-server',
            description: 'Check if the Golang server is available and healthy',
            parameters: ['serverUrl'],
          },
          {
            action: 'get-files',
            description: 'Get all files from the Golang server',
            parameters: ['serverUrl'],
          },
          {
            action: 'save-file',
            description: 'Save a file to the Golang server',
            parameters: ['serverUrl', 'path', 'content'],
          },
          {
            action: 'get-manifest',
            description: 'Get file manifest for sync operations',
            parameters: ['serverUrl'],
          },
        ],
      },
    },
    golangApiEndpoints: {
      health: 'GET /api/health',
      files: {
        list: 'GET /api/files',
        get: 'GET /api/files/{path}',
        create: 'POST /api/files/{path}',
        update: 'POST /api/files/{path}',
        delete: 'DELETE /api/files/{path}',
        move: 'PUT /api/files/move',
      },
      sync: {
        manifest: 'GET /api/sync/manifest',
        deploy: 'POST /api/deploy',
      },
      websocket: 'WS /ws',
    },
    minioIntegration: {
      storageType: 'Set STORAGE_TYPE=minio in Golang server environment',
      configuration: {
        S3_ENDPOINT: 'MinIO server endpoint (e.g., localhost:9000)',
        S3_ACCESS_KEY: 'MinIO access key (default: minioadmin)',
        S3_SECRET_KEY: 'MinIO secret key (default: minioadmin)',
        S3_BUCKET: 'MinIO bucket name (e.g., fern-fs-bucket)',
      },
    },
  });
}
