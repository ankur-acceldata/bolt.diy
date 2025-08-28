import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('mcpToolTimeout');

export interface ToolTimeoutConfig {
  toolName: string;
  timeoutMs: number;
  enableProgressUpdates?: boolean;
  progressInterval?: number;
}

export interface ProgressUpdate {
  toolCallId: string;
  message: string;
  progress?: number;
  timestamp: string;
}

/**
 * Service to handle timeouts and progress updates for long-running MCP tools
 */
export class MCPToolTimeoutService {
  private static _instance: MCPToolTimeoutService;
  private _toolTimeouts: Map<string, ToolTimeoutConfig> = new Map();
  private _progressHandlers: Map<string, NodeJS.Timeout> = new Map();
  private _activeTools: Map<string, { startTime: number; toolName: string }> = new Map();

  static getInstance(): MCPToolTimeoutService {
    if (!MCPToolTimeoutService._instance) {
      MCPToolTimeoutService._instance = new MCPToolTimeoutService();
    }

    return MCPToolTimeoutService._instance;
  }

  constructor() {
    this._initializeDefaultTimeouts();
  }

  /**
   * Initialize default timeout configurations for known long-running tools
   */
  private _initializeDefaultTimeouts(): void {
    // Configure long timeouts for specific tools
    this.setToolTimeout('execute_and_monitor', {
      toolName: 'execute_and_monitor',
      timeoutMs: 300000, // 5 minutes
      enableProgressUpdates: true,
      progressInterval: 15000, // Send progress every 15 seconds
    });

    this.setToolTimeout('adhoc_run', {
      toolName: 'adhoc_run',
      timeoutMs: 180000, // 3 minutes
      enableProgressUpdates: true,
      progressInterval: 10000, // Send progress every 10 seconds
    });

    // Add other long-running tools
    this.setToolTimeout('trino_execute_query', {
      toolName: 'trino_execute_query',
      timeoutMs: 120000, // 2 minutes
      enableProgressUpdates: true,
      progressInterval: 10000,
    });
  }

  /**
   * Set timeout configuration for a specific tool
   */
  setToolTimeout(toolName: string, config: ToolTimeoutConfig): void {
    this._toolTimeouts.set(toolName, config);
    logger.info(`Set timeout for tool ${toolName}: ${config.timeoutMs}ms`);
  }

  /**
   * Get timeout configuration for a tool
   */
  getToolTimeout(toolName: string): ToolTimeoutConfig | null {
    return this._toolTimeouts.get(toolName) || null;
  }

  /**
   * Start tracking a tool execution with progress updates
   */
  startToolExecution(toolCallId: string, toolName: string, progressCallback?: (update: ProgressUpdate) => void): void {
    this._activeTools.set(toolCallId, {
      startTime: Date.now(),
      toolName,
    });

    const config = this.getToolTimeout(toolName);

    if (!config || !config.enableProgressUpdates || !progressCallback) {
      return;
    }

    logger.info(`Starting progress tracking for ${toolName} (${toolCallId})`);

    // Set up progress updates
    const progressInterval = setInterval(() => {
      const execution = this._activeTools.get(toolCallId);

      if (!execution) {
        clearInterval(progressInterval);
        this._progressHandlers.delete(toolCallId);

        return;
      }

      const elapsed = Date.now() - execution.startTime;
      const progress = Math.min(90, (elapsed / config.timeoutMs) * 100); // Cap at 90% until completion

      const update: ProgressUpdate = {
        toolCallId,
        message: this._getProgressMessage(toolName, elapsed),
        progress,
        timestamp: new Date().toISOString(),
      };

      progressCallback(update);
    }, config.progressInterval);

    this._progressHandlers.set(toolCallId, progressInterval);
  }

  /**
   * Stop tracking a tool execution
   */
  stopToolExecution(toolCallId: string): void {
    const progressInterval = this._progressHandlers.get(toolCallId);

    if (progressInterval) {
      clearInterval(progressInterval);
      this._progressHandlers.delete(toolCallId);
    }

    this._activeTools.delete(toolCallId);
    logger.debug(`Stopped tracking tool execution: ${toolCallId}`);
  }

  /**
   * Generate appropriate progress messages based on tool and elapsed time
   */
  private _getProgressMessage(toolName: string, elapsedMs: number): string {
    const seconds = Math.floor(elapsedMs / 1000);

    switch (toolName) {
      case 'execute_and_monitor':
        if (seconds < 30) {
          return '🚀 Starting job execution and monitoring setup...';
        } else if (seconds < 60) {
          return '⚙️  Job is running, monitoring progress...';
        } else if (seconds < 120) {
          return '📊 Job execution in progress, collecting logs...';
        } else {
          return '⏳ Long-running job detected, still monitoring...';
        }

      case 'adhoc_run':
        if (seconds < 20) {
          return '🏗️  Setting up adhoc run environment...';
        } else if (seconds < 60) {
          return '🚀 Executing adhoc run job...';
        } else {
          return '⚙️  Adhoc run in progress, please wait...';
        }

      case 'trino_execute_query':
        if (seconds < 15) {
          return '📊 Connecting to Trino and preparing query...';
        } else if (seconds < 60) {
          return '🔍 Executing Trino query, processing data...';
        } else {
          return '⏳ Complex query execution, still processing...';
        }

      default:
        return `⚙️  ${toolName} is running... (${seconds}s elapsed)`;
    }
  }

  /**
   * Check if a tool execution has exceeded its timeout
   */
  isToolTimedOut(toolCallId: string): boolean {
    const execution = this._activeTools.get(toolCallId);

    if (!execution) {
      return false;
    }

    const config = this.getToolTimeout(execution.toolName);

    if (!config) {
      return false; // No timeout configured
    }

    const elapsed = Date.now() - execution.startTime;

    return elapsed > config.timeoutMs;
  }

  /**
   * Get elapsed time for a tool execution
   */
  getElapsedTime(toolCallId: string): number {
    const execution = this._activeTools.get(toolCallId);

    if (!execution) {
      return 0;
    }

    return Date.now() - execution.startTime;
  }

  /**
   * Clear all active tool executions (cleanup)
   */
  clearAllExecutions(): void {
    // Clear all progress intervals
    for (const [, interval] of this._progressHandlers) {
      clearInterval(interval);
    }

    this._progressHandlers.clear();
    this._activeTools.clear();
    logger.info('Cleared all active tool executions');
  }
}
