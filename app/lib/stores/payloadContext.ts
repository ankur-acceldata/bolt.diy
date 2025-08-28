import { createScopedLogger } from '~/utils/logger';
import type { AdhocRunRequestBody } from '~/types/jobConfig';

const logger = createScopedLogger('payloadContext');

interface AdhocRunPayload extends AdhocRunRequestBody {
  timestamp: string;
}

interface LogStreamPayload {
  dataplaneId: string;
  runId: string;
  tailLines: string;
  enabled?: boolean;
  initialDelay?: number;
  baseUrl?: string;
  timestamp: string;
}

interface PayloadContextStore {
  adhocRun: AdhocRunPayload | null;
  logStream: LogStreamPayload | null;
}

// Simple in-memory store for payload context
let payloadStore: PayloadContextStore = {
  adhocRun: null,
  logStream: null,
};

export class PayloadContextService {
  /**
   * Update adhoc run payload context
   */
  static updateAdhocRunPayload(payload: AdhocRunRequestBody): void {
    payloadStore.adhocRun = {
      ...payload, // Store the complete payload
      timestamp: new Date().toISOString(),
    };

    logger.info('Updated adhoc run payload context', { dataplaneId: payload.dataplaneId, jobType: payload.jobType });
  }

  /**
   * Update log stream payload context
   */
  static updateLogStreamPayload(
    dataplaneId: string,
    runId: string,
    tailLines: string,
    options?: { enabled?: boolean; initialDelay?: number; baseUrl?: string },
  ): void {
    payloadStore.logStream = {
      dataplaneId,
      runId,
      tailLines,
      enabled: options?.enabled,
      initialDelay: options?.initialDelay,
      baseUrl: options?.baseUrl,
      timestamp: new Date().toISOString(),
    };

    logger.info('Updated log stream payload context', { dataplaneId, runId, tailLines, options });
  }

  /**
   * Get current payload context for LLM prompt
   */
  static getPayloadContext(): string {
    const parts: string[] = [];

    if (payloadStore.adhocRun) {
      const adhocRun = payloadStore.adhocRun;
      parts.push(`
# LATEST ADHOC RUN PAYLOAD
**CRITICAL: Use these exact values for any adhoc run MCP tool calls:**

## Main Parameters:
- dataplaneId: ${adhocRun.dataplaneId}
- jobType: "${adhocRun.jobType}"
- description: "${adhocRun.description || ''}"
- name: "${adhocRun.name || ''}"

## Execution Configuration:
- jobType: "${adhocRun.executionConfig.jobType}"
- image: "${adhocRun.executionConfig.image}"
- imagePullSecrets: ${JSON.stringify(adhocRun.executionConfig.imagePullSecrets)}
- imagePullPolicy: "${adhocRun.executionConfig.imagePullPolicy}"
- type: "${adhocRun.executionConfig.type}"
- mode: "${adhocRun.executionConfig.mode}"
- timeToLiveSeconds: ${adhocRun.executionConfig.timeToLiveSeconds}

## Code Source:
- type: "${adhocRun.executionConfig.codeSource.type}"
- url: "${adhocRun.executionConfig.codeSource.config.url}"

## Stages:
${adhocRun.executionConfig.stages.map((stage, index) => `- Stage ${index + 1}: ${JSON.stringify(stage)}`).join('\n')}

## Driver Configuration:
- cores: ${adhocRun.executionConfig.driver.cores}
- memory: "${adhocRun.executionConfig.driver.memory}"
- memoryOverhead: "${adhocRun.executionConfig.driver.memoryOverhead}"

## Executor Configuration:
- instances: ${adhocRun.executionConfig.executor.instances || 1}
- cores: ${adhocRun.executionConfig.executor.cores}
- memory: "${adhocRun.executionConfig.executor.memory}"
- memoryOverhead: "${adhocRun.executionConfig.executor.memoryOverhead}"

## Dynamic Allocation:
- enabled: ${adhocRun.executionConfig.dynamicAllocation.enabled}
- initialExecutors: ${adhocRun.executionConfig.dynamicAllocation.initialExecutors}
- minExecutors: ${adhocRun.executionConfig.dynamicAllocation.minExecutors}
- maxExecutors: ${adhocRun.executionConfig.dynamicAllocation.maxExecutors}
- shuffleTrackingTimeout: ${adhocRun.executionConfig.dynamicAllocation.shuffleTrackingTimeout || 'null'}

## Dependencies:
- dataStores: ${JSON.stringify(adhocRun.executionConfig.depends.dataStores)}

## Spark Configuration:
${
  Object.entries(adhocRun.executionConfig.sparkConf || {})
    .map(([key, value]) => `- ${key}: ${JSON.stringify(value)}`)
    .join('\n') || '- (No spark config)'
}

## Complete Payload (JSON):
\`\`\`json
${JSON.stringify(adhocRun, null, 2)}
\`\`\`

- Last used: ${adhocRun.timestamp}

**INSTRUCTION: When making adhoc run MCP tool calls, use the above values exactly as provided. Do not modify or generate these parameters.**`);
    }

    if (payloadStore.logStream) {
      const logStream = payloadStore.logStream;
      parts.push(`
# LATEST LOG STREAM PAYLOAD
**CRITICAL: Use these exact values for any log stream MCP tool calls:**

## Main Parameters:
- dataplaneId: "${logStream.dataplaneId}"
- runId: "${logStream.runId}"
- tailLines: "${logStream.tailLines}"

## Additional Context:
- enabled: ${logStream.enabled !== undefined ? logStream.enabled : 'true'}
- initialDelay: ${logStream.initialDelay || 'default'}
- baseUrl: "${logStream.baseUrl || 'auto-detected'}"

## Complete Payload (JSON):
\`\`\`json
${JSON.stringify(logStream, null, 2)}
\`\`\`

- Last used: ${logStream.timestamp}

**INSTRUCTION: When making log stream MCP tool calls, use the above values exactly as provided. Do not modify or generate these parameters.**`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `
## CURRENT API PAYLOAD CONTEXT
${parts.join('\n')}

**IMPORTANT: These are the most recent payload values from API calls. Always use these exact values when making MCP tool calls for adhoc runs or log streams. Never modify, assume, or generate these parameters.**
`;
  }

  /**
   * Clear all payload context
   */
  static clearPayloadContext(): void {
    payloadStore = {
      adhocRun: null,
      logStream: null,
    };
    logger.info('Cleared all payload context');
  }

  /**
   * Get raw payload store (for debugging)
   */
  static getPayloadStore(): PayloadContextStore {
    return { ...payloadStore };
  }
}
