import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.log-stream');

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dataplaneId = url.searchParams.get('dataplaneId');
  const podName = url.searchParams.get('podName');
  const tailLines = url.searchParams.get('tailLines') || '50';

  logger.info(`Log stream request - dataplaneId: ${dataplaneId}, podName: ${podName}, tailLines: ${tailLines}`);

  if (!dataplaneId || !podName) {
    logger.error('Missing required parameters');
    return new Response('Missing required parameters: dataplaneId and podName', { status: 400 });
  }

  // Get authentication keys
  const accessKey = (context?.cloudflare?.env as any)?.ACCELDATA_ACCESS_KEY || process.env.ACCELDATA_ACCESS_KEY;
  const secretKey = (context?.cloudflare?.env as any)?.ACCELDATA_SECRET_KEY || process.env.ACCELDATA_SECRET_KEY;

  logger.info(`Auth keys available - accessKey: ${!!accessKey}, secretKey: ${!!secretKey}`);

  if (!accessKey || !secretKey) {
    logger.error('Missing authentication keys');
    return new Response('Authentication keys not configured', { status: 500 });
  }

  try {
    // Get base URL from HOST environment variable
    const host = (context?.cloudflare?.env as any)?.HOST || process.env.HOST || 'demo.xdp.acceldata.tech';
    const baseUrl = host.startsWith('http') ? host : `https://${host}`;

    // Use the correct SSE endpoint format
    const endpoint = `${baseUrl}/xdp-cp-service/api/dataplane/${dataplaneId}/logs/${podName}/sse?tailLines=${tailLines}`;

    logger.info(`Streaming logs from: ${endpoint}`);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let timeoutId: NodeJS.Timeout | null = null;

        try {
          logger.info('Initiating connection to backend log stream...');

          const response = await fetch(endpoint, {
            headers: {
              accessKey,
              secretKey,
              Accept: 'text/event-stream',
              'Cache-Control': 'no-cache',
            },
          });

          logger.info(`Backend response status: ${response.status} ${response.statusText}`);
          logger.info(`Backend response headers:`, Object.fromEntries(response.headers.entries()));

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'No error text available');
            logger.error(`Backend connection failed: ${response.status} ${response.statusText}, Body: ${errorText}`);
            throw new Error(
              `Failed to connect to log stream: ${response.status} ${response.statusText} - ${errorText}`,
            );
          }

          if (!response.body) {
            logger.error('No response body from backend');
            throw new Error('No response body from log stream');
          }

          reader = response.body.getReader();

          const decoder = new TextDecoder();

          logger.info('Successfully connected to backend, starting to read stream...');

          // Send initial connection message
          const connectMsg = `data: ${JSON.stringify({
            log: `Connected to log stream for ${dataplaneId}/${podName}`,
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(connectMsg));

          let buffer = '';
          let lastDataReceived = Date.now();

          // Set up a keep-alive mechanism
          const sendKeepAlive = () => {
            const now = Date.now();

            // Send keep-alive every 30 seconds if no data received
            if (now - lastDataReceived > 30000) {
              const keepAliveMsg = `data: ${JSON.stringify({
                log: `Keep-alive: Monitoring logs for ${dataplaneId}/${podName}`,
                timestamp: new Date().toISOString(),
                keepAlive: true,
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(keepAliveMsg));
              lastDataReceived = now;
            }
          };

          // Start keep-alive timer
          timeoutId = setInterval(sendKeepAlive, 30000);

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                logger.info('Stream ended normally');
                break;
              }

              lastDataReceived = Date.now();

              const chunk = decoder.decode(value, { stream: true });
              logger.debug(`Received chunk: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);

              // Add to buffer for proper SSE parsing
              buffer += chunk;

              // Process complete SSE messages
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    // Extract the JSON data from the SSE format
                    const dataStr = line.substring(6); // Remove 'data: ' prefix

                    // Try to parse as JSON first
                    let logData;

                    try {
                      logData = JSON.parse(dataStr);
                    } catch {
                      // If not JSON, treat as plain text log
                      logData = { log: dataStr, timestamp: new Date().toISOString() };
                    }

                    // Forward the data in SSE format
                    const formattedChunk = `data: ${JSON.stringify(logData)}\n\n`;
                    controller.enqueue(new TextEncoder().encode(formattedChunk));

                    logger.debug('Forwarded log data:', logData);
                  } catch (parseError) {
                    logger.error('Error parsing SSE data:', parseError);
                  }
                } else if (line.trim() === '') {
                  // Empty line - end of SSE message, send it through
                  controller.enqueue(new TextEncoder().encode('\n'));
                } else if (line.includes(':')) {
                  // Other SSE fields (event, id, retry, etc.)
                  controller.enqueue(new TextEncoder().encode(line + '\n'));
                }
              }
            }
          } catch (readError) {
            logger.error('Error reading log stream:', readError);

            const errorData = `data: ${JSON.stringify({
              error: readError instanceof Error ? readError.message : 'Stream error',
              timestamp: new Date().toISOString(),
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorData));
          }
        } catch (error) {
          logger.error('Error connecting to log stream:', error);

          const errorData = `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Connection error',
            timestamp: new Date().toISOString(),
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
        } finally {
          if (timeoutId) {
            clearInterval(timeoutId);
          }

          if (reader) {
            try {
              reader.releaseLock();
            } catch (lockError) {
              logger.error('Error releasing reader lock:', lockError);
            }
          }

          controller.close();
          logger.info('Log stream controller closed');
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error) {
    logger.error('Log stream error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
