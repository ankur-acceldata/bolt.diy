import { type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { AcceldataService } from '~/lib/services/acceldataService';

const logger = createScopedLogger('api.pipeline-log-stream');

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dataplaneId = url.searchParams.get('dataplaneId');
  const jobId = url.searchParams.get('jobId');
  const tailLines = url.searchParams.get('tailLines') || '50';

  logger.info(`🔧 Pipeline log stream request - dataplaneId: ${dataplaneId}, jobId: ${jobId}, tailLines: ${tailLines}`);

  if (!dataplaneId || !jobId) {
    logger.error('Missing required parameters');
    return new Response('Missing required parameters: dataplaneId and jobId', { status: 400 });
  }

  // Check if service is configured
  if (!AcceldataService.isConfigured()) {
    logger.error('Acceldata service not configured');
    return new Response('Acceldata service not configured', { status: 500 });
  }

  try {
    logger.info(`Streaming pipeline logs for dataplaneId: ${dataplaneId}, jobId: ${jobId}`);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
        let timeoutId: NodeJS.Timeout | null = null;

        const connectWithRetry = async (retryCount = 0): Promise<Response> => {
          const maxRetries = 3;
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s

          try {
            logger.info(
              `Initiating connection to backend pipeline log stream... (attempt ${retryCount + 1}/${maxRetries + 1})`,
            );

            // Use centralized AcceldataService for consistent header handling
            logger.info(
              `🔧 Attempting to connect to pipeline log stream: /api/pipelines/runs/${jobId}/logs/sse?tailLines=${tailLines}`,
            );

            const response = await AcceldataService.callStream(
              `/api/pipelines/runs/${jobId}/logs/sse?tailLines=${tailLines}`,
              {
                requestHeaders: request.headers,
                request,
                additionalHeaders: {
                  Accept: 'text/event-stream',
                  'Cache-Control': 'no-cache',
                  'User-Agent': 'Mozilla/5.0 (compatible; PipelineLogStreamClient/1.0)',
                  Connection: 'keep-alive',
                },
              },
            );

            logger.info(`Backend pipeline response status: ${response.status} ${response.statusText}`);
            logger.info(`Backend pipeline response headers:`, Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
              const errorText = await response.text().catch(() => 'No error text available');
              logger.error(
                `Backend pipeline connection failed: ${response.status} ${response.statusText}, Body: ${errorText}`,
              );

              // Handle specific error cases
              if (response.status === 502) {
                const errorMsg = `Pipeline logs unavailable (502 Bad Gateway). The job "${jobId}" may have completed execution, been terminated, or not yet started. This is common for short-lived jobs.`;

                if (retryCount < maxRetries) {
                  logger.info(`Retrying pipeline connection in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
                  await new Promise((resolve) => setTimeout(resolve, retryDelay));

                  return connectWithRetry(retryCount + 1);
                }

                throw new Error(errorMsg);
              }

              if (response.status === 404) {
                throw new Error(
                  `Pipeline job "${jobId}" not found in dataplane "${dataplaneId}". Please verify the job id and dataplane ID.`,
                );
              }

              if (response.status >= 500) {
                const errorMsg = `Backend server error (${response.status}). Please try again later.`;

                if (retryCount < maxRetries) {
                  logger.info(`Retrying pipeline connection in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
                  await new Promise((resolve) => setTimeout(resolve, retryDelay));

                  return connectWithRetry(retryCount + 1);
                }

                throw new Error(errorMsg);
              }

              throw new Error(
                `Failed to connect to pipeline log stream: ${response.status} ${response.statusText} - ${errorText}`,
              );
            }

            return response;
          } catch (error) {
            if (
              retryCount < maxRetries &&
              (error instanceof TypeError || (error as Error).message?.includes('fetch'))
            ) {
              logger.info(
                `Network error, retrying pipeline connection in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelay));

              return connectWithRetry(retryCount + 1);
            }

            throw error;
          }
        };

        try {
          const response = await connectWithRetry();

          if (!response.body) {
            logger.error('No response body from backend pipeline stream');
            throw new Error('No response body from pipeline log stream');
          }

          reader = response.body.getReader();

          const decoder = new TextDecoder();

          logger.info('Successfully connected to backend pipeline stream, starting to read stream...');

          // Send initial connection message
          const connectMsg = `data: ${JSON.stringify({
            log: `Connected to pipeline log stream for job:${jobId}`,
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
                log: `Keep-alive: Monitoring pipeline logs for job:${jobId}`,
                keepAlive: true,
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(keepAliveMsg));
              lastDataReceived = now;
            }
          };

          // Start keep-alive timer (corrected: 30 seconds = 30,000ms)
          timeoutId = setInterval(sendKeepAlive, 30000);

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                logger.info('Pipeline stream ended normally');
                break;
              }

              lastDataReceived = Date.now();

              const chunk = decoder.decode(value, { stream: true });
              logger.debug(`Received pipeline chunk: ${chunk.substring(0, 200)}${chunk.length > 200 ? '...' : ''}`);

              // Normalize CRLF and add to buffer for proper SSE parsing
              buffer += chunk.replace(/\r\n/g, '\n');

              // Process complete lines
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? ''; // Keep incomplete line in buffer

              for (const rawLine of lines) {
                const line = rawLine.trimEnd();

                // Match both "data:payload" and "data: payload" using robust regex
                const match = /^data:\s?(.*)$/.exec(line);

                if (match) {
                  try {
                    // Extract the log content from the matched regex group
                    const logContent = match[1];

                    // Skip empty data lines (they're SSE event separators)
                    if (logContent.length === 0) {
                      continue;
                    }

                    /*
                     * Create LogEntry object and send immediately (don't accumulate)
                     * This preserves the original backend chunking behavior
                     */
                    const logData = {
                      log: logContent,
                    };

                    // Forward the data in SSE format expected by frontend
                    const formattedChunk = `data: ${JSON.stringify(logData)}\n\n`;
                    controller.enqueue(new TextEncoder().encode(formattedChunk));

                    logger.debug('Forwarded pipeline log data:', logData);
                  } catch (parseError) {
                    logger.error('Error processing pipeline SSE data:', parseError);

                    // Send error as log entry
                    const errorData = {
                      error: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                    };

                    const errorChunk = `data: ${JSON.stringify(errorData)}\n\n`;
                    controller.enqueue(new TextEncoder().encode(errorChunk));
                  }
                }

                // Note: We don't need to forward other SSE fields since we're transforming the format
              }
            }
          } catch (readError) {
            logger.error('Error reading pipeline log stream:', readError);

            const errorData = `data: ${JSON.stringify({
              error: readError instanceof Error ? readError.message : 'Pipeline stream error',
            })}\n\n`;
            controller.enqueue(new TextEncoder().encode(errorData));
          }
        } catch (error) {
          logger.error('Error connecting to pipeline log stream:', error);

          const errorData = `data: ${JSON.stringify({
            error: error instanceof Error ? error.message : 'Pipeline connection error',
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
              logger.error('Error releasing pipeline reader lock:', lockError);
            }
          }

          controller.close();
          logger.info('Pipeline log stream controller closed');
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering in Nginx/Kong
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  } catch (error) {
    logger.error('Pipeline log stream error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
