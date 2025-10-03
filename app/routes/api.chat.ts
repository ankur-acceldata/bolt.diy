/* eslint-disable @typescript-eslint/no-unused-vars */
import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createDataStream, generateId } from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS, type FileMap } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/common/prompts/prompts';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';
import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { getFilePaths, selectContext } from '~/lib/.server/llm/select-context';
import type { ContextAnnotation, ProgressAnnotation } from '~/types/context';
import { WORK_DIR } from '~/utils/constants';
import { createSummary } from '~/lib/.server/llm/create-summary';
import { extractPropertiesFromMessage } from '~/lib/.server/llm/utils';
import type { DesignScheme } from '~/types/design-scheme';
import { MCPService } from '~/lib/services/mcpService';
import { createXDPMCPConfig, DEFAULT_XDP_CONFIG } from '~/lib/xdp-mcp-config';
import { getProjectId } from '~/utils/fileLocks';
import { TIMEOUT_CONSTANTS } from '~/lib/constants/timeout';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

const logger = createScopedLogger('api.chat');

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const {
    messages,
    files,
    promptId,
    contextOptimization,
    supabase,
    chatMode,
    designScheme,
    maxLLMSteps,
    selectedTemplate,
    chatId,
    dataplaneId,
    dataplaneName,
  } = await request.json<{
    messages: Messages;
    files: any;
    promptId?: string;
    contextOptimization: boolean;
    chatMode: 'discuss' | 'build';
    designScheme?: DesignScheme;
    selectedTemplate?: {
      id: string;
      name: string;
    };
    supabase?: {
      isConnected: boolean;
      hasSelectedProject: boolean;
      credentials?: {
        anonKey?: string;
        supabaseUrl?: string;
      };
    };
    maxLLMSteps: number;
    chatId?: string;
    dataplaneId?: string;
    dataplaneName?: string;
  }>();

  const cookieHeader = request.headers.get('Cookie');
  const apiKeys = JSON.parse(parseCookies(cookieHeader || '').apiKeys || '{}');
  const providerSettings: Record<string, IProviderSetting> = JSON.parse(
    parseCookies(cookieHeader || '').providers || '{}',
  );

  const stream = new SwitchableStream();

  const cumulativeUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
  const encoder: TextEncoder = new TextEncoder();
  let progressCounter: number = 1;

  // Keep-alive mechanism for long-running requests
  let keepAliveInterval: NodeJS.Timeout | null = null;
  let lastActivityTime = Date.now();

  try {
    const mcpService = MCPService.getInstance();

    /*
     * Skip XDP config override in chat API - let the store handle initialization
     * This prevents overriding environment variables with hard-coded defaults
     */
    logger.debug('Skipping XDP config override in chat API - using store configuration');

    const totalMessageContent = messages.reduce((acc, message) => {
      const messageContent = message.content as string | any[];
      const content =
        typeof messageContent === 'string'
          ? messageContent
          : Array.isArray(messageContent)
            ? messageContent
                .map((item: any) =>
                  typeof item === 'string'
                    ? item
                    : item && typeof item === 'object' && item.type === 'text'
                      ? typeof item.text === 'string'
                        ? item.text
                        : ''
                      : '',
                )
                .join(' ')
            : '';

      return acc + content;
    }, '');
    logger.debug(`Total message length: ${totalMessageContent.split(' ').length}, words`);

    let lastChunk: string | undefined = undefined;

    logger.debug('Creating data stream for chat request');

    // Helper function to send keep-alive messages
    const sendKeepAlive = (dataStream: any) => {
      const now = Date.now();

      if (now - lastActivityTime > TIMEOUT_CONSTANTS.KEEP_ALIVE_INTERVAL) {
        logger.debug('Sending keep-alive message to prevent timeout');
        dataStream.writeData({
          type: 'progress',
          label: 'keep-alive',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Processing...',
        } satisfies ProgressAnnotation);
        lastActivityTime = now;
      }
    };

    // Start keep-alive interval
    keepAliveInterval = setInterval(() => {
      const now = Date.now();

      if (now - lastActivityTime > TIMEOUT_CONSTANTS.MAX_IDLE_TIME) {
        logger.warn('Request exceeded maximum idle time, cleaning up');

        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        return;
      }
    }, TIMEOUT_CONSTANTS.KEEP_ALIVE_INTERVAL);

    const dataStream = createDataStream({
      async execute(dataStream) {
        logger.debug('Data stream execution started');
        lastActivityTime = Date.now(); // Update activity time

        const filePaths = getFilePaths(files || {});
        let filteredFiles: FileMap | undefined = undefined;
        let summary: string | undefined = undefined;
        let messageSliceId = 0;

        let processedMessages;

        try {
          processedMessages = await mcpService.processToolInvocations(messages, dataStream);
        } catch (error) {
          logger.error('Error in processToolInvocations, continuing with original messages:', error);

          // If tool invocations fail, continue with original messages rather than failing completely
          processedMessages = messages;
        }

        // Ensure we have a valid chat ID - no fallback to random generation
        if (!chatId) {
          throw new Error('Chat ID is required. Frontend should create a backend project first.');
        }

        const sessionId = chatId;

        // Get current project context
        const currentProjectId = getProjectId();

        /*
         * The tool policy is now included in the system prompt via getSystemPrompt()
         * which imports it from the centralized tool-policy.ts file
         * No need to inject it separately here
         */

        if (processedMessages.length > 3) {
          messageSliceId = processedMessages.length - 3;
        }

        if (filePaths.length > 0 && contextOptimization) {
          logger.debug('Generating Chat Summary');
          lastActivityTime = Date.now(); // Update activity time
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Analysing Request',
          } satisfies ProgressAnnotation);

          // Create a summary of the chat
          console.log(`Messages count: ${processedMessages.length}`);

          summary = await createSummary({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            providerSettings,
            promptId,
            contextOptimization,
            onFinish(resp) {
              lastActivityTime = Date.now(); // Update activity time

              if (resp.usage) {
                logger.debug('createSummary token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });
          dataStream.writeData({
            type: 'progress',
            label: 'summary',
            status: 'complete',
            order: progressCounter++,
            message: 'Analysis Complete',
          } satisfies ProgressAnnotation);

          dataStream.writeMessageAnnotation({
            type: 'chatSummary',
            summary,
            chatId: processedMessages.slice(-1)?.[0]?.id,
          } as ContextAnnotation);

          // Update context buffer
          logger.debug('Updating Context Buffer');
          lastActivityTime = Date.now(); // Update activity time
          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: 'Determining Files to Read',
          } satisfies ProgressAnnotation);

          // Select context files
          console.log(`Messages count: ${processedMessages.length}`);
          filteredFiles = await selectContext({
            messages: [...processedMessages],
            env: context.cloudflare?.env,
            apiKeys,
            files,
            providerSettings,
            promptId,
            contextOptimization,
            summary,
            onFinish(resp) {
              lastActivityTime = Date.now(); // Update activity time

              if (resp.usage) {
                logger.debug('selectContext token usage', JSON.stringify(resp.usage));
                cumulativeUsage.completionTokens += resp.usage.completionTokens || 0;
                cumulativeUsage.promptTokens += resp.usage.promptTokens || 0;
                cumulativeUsage.totalTokens += resp.usage.totalTokens || 0;
              }
            },
          });

          if (filteredFiles) {
            logger.debug(`files in context : ${JSON.stringify(Object.keys(filteredFiles))}`);
          }

          dataStream.writeMessageAnnotation({
            type: 'codeContext',
            files: Object.keys(filteredFiles).map((key) => {
              let path = key;

              if (path.startsWith(WORK_DIR)) {
                path = path.replace(WORK_DIR, '');
              }

              return path;
            }),
          } as ContextAnnotation);

          dataStream.writeData({
            type: 'progress',
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: 'Code Files Selected',
          } satisfies ProgressAnnotation);

          // logger.debug('Code Files Selected');
        }

        const options: StreamingOptions = {
          supabaseConnection: supabase,
          toolChoice: 'auto',

          // Provide executable tools so the LLM can auto-run tools during reasoning
          tools: mcpService.tools,
          maxSteps: maxLLMSteps,
          onStepFinish: ({ toolCalls }) => {
            // add tool call annotations for frontend processing
            lastActivityTime = Date.now(); // Update activity time

            try {
              toolCalls.forEach((toolCall) => {
                mcpService.processToolCall(toolCall, dataStream);
              });
            } catch (error) {
              logger.error('Error in onStepFinish toolCall processing, continuing stream:', error);

              // Continue processing even if tool call annotations fail
            }
          },
          onFinish: async ({ text: content, finishReason, usage }) => {
            logger.debug('usage', JSON.stringify(usage));
            lastActivityTime = Date.now(); // Update activity time

            if (usage) {
              cumulativeUsage.completionTokens += usage.completionTokens || 0;
              cumulativeUsage.promptTokens += usage.promptTokens || 0;
              cumulativeUsage.totalTokens += usage.totalTokens || 0;
            }

            /*
             * Only treat 'stop' and 'length' as true completion
             * 'tool-calls' means the model paused for tool execution but should continue
             */
            if (finishReason === 'stop' || finishReason === 'length') {
              dataStream.writeMessageAnnotation({
                type: 'usage',
                value: {
                  completionTokens: cumulativeUsage.completionTokens,
                  promptTokens: cumulativeUsage.promptTokens,
                  totalTokens: cumulativeUsage.totalTokens,
                },
              });
              dataStream.writeData({
                type: 'progress',
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: 'Response Generated',
              } satisfies ProgressAnnotation);
              await new Promise((resolve) => setTimeout(resolve, 0));

              // stream.close();
              return;
            }

            // For tool-calls finish reason, log but don't end the response
            if (finishReason === 'tool-calls') {
              logger.debug('Model paused for tool execution, will continue after tools complete');
              return;
            }

            if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
              throw Error('Cannot continue message: Maximum segments reached');
            }

            const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

            logger.info(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

            const lastUserMessage = processedMessages.filter((x) => x.role == 'user').slice(-1)[0];
            const { model, provider } = extractPropertiesFromMessage(lastUserMessage);
            processedMessages.push({ id: generateId(), role: 'assistant', content });
            processedMessages.push({
              id: generateId(),
              role: 'user',
              content: `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${CONTINUE_PROMPT}`,
            });

            logger.debug(`Initiating continuation streamText (switch ${stream.switches + 1}/${MAX_RESPONSE_SEGMENTS})`);

            const result = await streamText({
              messages: [...processedMessages],
              env: context.cloudflare?.env,
              options,
              apiKeys,
              files,
              providerSettings,
              promptId,
              contextOptimization,
              contextFiles: filteredFiles,
              chatMode,
              designScheme,
              selectedTemplate,
              summary,
              messageSliceId,
              dataplaneId,
              dataplaneName,
            });
            logger.debug('Continuation streamText initiated successfully');

            result.mergeIntoDataStream(dataStream);

            (async () => {
              let continuationStreamChunkCount = 0;
              logger.debug('Starting continuation stream processing');

              for await (const part of result.fullStream) {
                continuationStreamChunkCount++;

                if (part.type === 'error') {
                  const error: any = part.error;
                  logger.error(
                    `Continuation stream error on chunk ${continuationStreamChunkCount}: ${JSON.stringify(error, null, 2)}`,
                  );

                  // Check if it's a tool execution error that we can recover from
                  if (error?.message?.includes('Error executing tool') || error?.name === 'AI_ToolExecutionError') {
                    logger.warn('Tool execution error in continuation stream detected, attempting to continue...');

                    // Don't return immediately - try to continue processing
                    continue;
                  }

                  return;
                }

                if (part.type === 'text-delta' && continuationStreamChunkCount % 10 === 0) {
                  logger.debug(`Continuation stream in progress - processed ${continuationStreamChunkCount} chunks`);
                }
              }

              logger.debug(`Continuation stream completed - total chunks: ${continuationStreamChunkCount}`);
            })();

            return;
          },
        };

        lastActivityTime = Date.now(); // Update activity time
        dataStream.writeData({
          type: 'progress',
          label: 'response',
          status: 'in-progress',
          order: progressCounter++,
          message: 'Generating Response',
        } satisfies ProgressAnnotation);

        logger.debug('Initiating streamText for main response generation');

        const result = await streamText({
          messages: [...processedMessages],
          env: context.cloudflare?.env,
          options,
          apiKeys,
          files,
          providerSettings,
          promptId,
          contextOptimization,
          contextFiles: filteredFiles,
          chatMode,
          designScheme,
          selectedTemplate,
          summary,
          messageSliceId,
          dataplaneId,
          dataplaneName,
        });
        logger.debug('streamText initiated successfully');

        (async () => {
          let fullContent = '';
          let streamChunkCount = 0;
          logger.debug('Starting stream processing for fullStream');

          for await (const part of result.fullStream) {
            streamChunkCount++;
            lastActivityTime = Date.now(); // Update activity time on each chunk

            if (part.type === 'error') {
              const error: any = part.error;
              logger.error(`Stream error on chunk ${streamChunkCount}: ${error}`);

              // Check if it's a tool execution error that we can recover from
              if (error?.message?.includes('Error executing tool') || error?.name === 'AI_ToolExecutionError') {
                logger.warn('Tool execution error detected, attempting to continue stream processing...');

                // Don't return immediately - try to continue processing
                continue;
              }

              return;
            }

            if (part.type === 'text-delta') {
              fullContent += part.textDelta;

              if (streamChunkCount % 10 === 0) {
                logger.debug(
                  `Stream in progress - processed ${streamChunkCount} chunks, content length: ${fullContent.length}`,
                );

                // Send keep-alive every 10 chunks to maintain connection
                sendKeepAlive(dataStream);
              }
            }
          }

          logger.debug(
            `Stream completed - total chunks: ${streamChunkCount}, final content length: ${fullContent.length}`,
          );

          // Log the full response to check for workbench-action elements
          console.log('🔍 FULL LLM RESPONSE LENGTH:', fullContent.length);
          console.log('🎯 LLM RESPONSE CONTAINS workbench-action:', fullContent.includes('workbench-action'));
          console.log('🔍 First 1000 chars of response:', fullContent.substring(0, 1000));
          console.log('🔍 Last 1000 chars of response:', fullContent.substring(Math.max(0, fullContent.length - 1000)));
        })();
        result.mergeIntoDataStream(dataStream);
        logger.debug('Data stream execution completed');
      },
      onError: (error: any) => {
        logger.error(`Data stream error: ${error.message}`);

        // Clean up keep-alive interval on error
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        return `Custom error: ${error.message}`;
      },
    }).pipeThrough(
      new TransformStream({
        start: () => {
          logger.debug('Transform stream started - beginning chunk transformation');
        },
        transform: (chunk, controller) => {
          // Add detailed logging for each chunk transformation
          const chunkType = typeof chunk;
          const chunkSize = chunk?.length || 0;
          lastActivityTime = Date.now(); // Update activity time on each chunk
          logger.debug(
            `Transforming chunk: type=${chunkType}, size=${chunkSize}, preview=${String(chunk).substring(0, 100)}`,
          );

          if (!lastChunk) {
            lastChunk = ' ';
          }

          if (typeof chunk === 'string') {
            if (chunk.startsWith('g') && !lastChunk.startsWith('g')) {
              const thoughtStart = `0: "<div class=\\"__boltThought__\\">"\n`;
              logger.debug('Injecting thought start marker');
              controller.enqueue(encoder.encode(thoughtStart));
            }

            if (lastChunk.startsWith('g') && !chunk.startsWith('g')) {
              const thoughtEnd = `0: "</div>\\n"\n`;
              logger.debug('Injecting thought end marker');
              controller.enqueue(encoder.encode(thoughtEnd));
            }
          }

          lastChunk = chunk;

          let transformedChunk = chunk;

          if (typeof chunk === 'string' && chunk.startsWith('g')) {
            let content = chunk.split(':').slice(1).join(':');

            if (content.endsWith('\n')) {
              content = content.slice(0, content.length - 1);
            }

            transformedChunk = `0:${content}\n`;
            logger.debug(`Transformed 'g' chunk: ${transformedChunk.substring(0, 100)}`);
          }

          // Convert the string stream to a byte stream
          const str = typeof transformedChunk === 'string' ? transformedChunk : JSON.stringify(transformedChunk);
          const encodedBytes = encoder.encode(str);

          logger.debug(`Enqueuing ${encodedBytes.length} bytes to controller`);
          controller.enqueue(encodedBytes);
        },
        flush: () => {
          logger.debug('Transform stream completed - all chunks transformed and flushed');

          // Clean up keep-alive interval when stream completes
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
        },
      }),
    );

    logger.debug('Returning streaming response to client');

    /*
     * The AI SDK createDataStream outputs its own format, not SSE format
     * Add a test to verify streaming is working by adding timestamps
     */
    const timestampedStream = dataStream.pipeThrough(
      new TransformStream({
        start() {
          logger.debug(`🚀 Stream started at: ${new Date().toISOString()}`);
        },
        transform(chunk, controller) {
          const now = new Date().toISOString();
          logger.debug(`📦 Chunk received at: ${now}, size: ${chunk?.length || 0}`);
          controller.enqueue(chunk);
        },
        flush() {
          logger.debug(`🏁 Stream completed at: ${new Date().toISOString()}`);
        },
      }),
    );

    /*
     * AI SDK createDataStream outputs its own format, not SSE format
     * The useChat hook expects AI SDK streaming format, NOT SSE format
     * So we should use the AI SDK's expected content type
     */
    return new Response(timestampedStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8', // AI SDK streaming format
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no', // Disable NGINX buffering
        'Transfer-Encoding': 'chunked',
        Pragma: 'no-cache',
        Expires: '0',

        // Add timeout-related headers
        'Keep-Alive': `timeout=${TIMEOUT_CONSTANTS.CHAT_REQUEST_TIMEOUT / 1000}, max=1000`,
        'X-Stream-Timeout': TIMEOUT_CONSTANTS.CHAT_REQUEST_TIMEOUT.toString(),
      },
    });
  } catch (error: any) {
    logger.error(error);

    // Clean up keep-alive interval on error
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }

    const errorResponse = {
      error: true,
      message: error.message || 'An unexpected error occurred',
      statusCode: error.statusCode || 500,
      isRetryable: error.isRetryable !== false, // Default to retryable unless explicitly false
      provider: error.provider || 'unknown',
    };

    if (error.message?.includes('API key')) {
      return new Response(
        JSON.stringify({
          ...errorResponse,
          message: 'Invalid or missing API key',
          statusCode: 401,
          isRetryable: false,
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
          statusText: 'Unauthorized',
        },
      );
    }

    return new Response(JSON.stringify(errorResponse), {
      status: errorResponse.statusCode,
      headers: { 'Content-Type': 'application/json' },
      statusText: 'Error',
    });
  }
}
