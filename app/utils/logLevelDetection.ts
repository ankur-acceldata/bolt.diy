export type LogLevel = 'error' | 'warning' | 'success' | 'info' | 'normal';

export interface LogLevelConfig {
  level: LogLevel;
  className: string;
  patterns: string[];
}

const LOG_LEVEL_CONFIGS: LogLevelConfig[] = [
  {
    level: 'error',
    className: 'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-l-2 border-red-500',
    patterns: [
      // Specific error patterns (checked first to avoid false positives)
      'exit code]: -1',
      'status: failed',
      'execution completed with status failed',
      'error reading stderr',
      'error streaming logs',
      'connection to log stream failed',
      'build failed',
      'test failed',
      'deployment failed',
      'pipeline failed',
      'job failed',
      'task failed',
      'process failed',

      // Generic error patterns
      'error:',
      'error ',
      '"error":',
      'failed:',
      'failed ',
      'failure:',
      'failure ',
      'exception',
      'fatal',
      'critical',
      'stack trace',
      'traceback',
      'panic',
      'abort',
      'crash',
      'timeout',
      'refused',
      'denied',
      'forbidden',
      'unauthorized',
      'not found',
      '404',
      '500',
      '502',
      '503',
      '504',
    ],
  },
  {
    level: 'warning',
    className:
      'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-l-2 border-yellow-500',
    patterns: [
      'warning',
      'warn',
      'deprecated',
      'status: echo_failed',
      'caution',
      'notice',
      'retry',
      'retrying',
      'fallback',
      'skipping',
      'skipped',
      'ignored',
      'partial',
    ],
  },
  {
    level: 'success',
    className: 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-l-2 border-green-500',
    patterns: [
      // Specific success patterns (more precise to avoid conflicts)
      '✅',
      '🎉',
      'completed successfully',
      'executed successfully',
      'finished successfully',
      'all tests passed',
      'build succeeded',
      'deployment succeeded',
      'pipeline succeeded',
      'job succeeded',
      'task succeeded',
      'process succeeded',
      'log stream completed',
      'success:',
      'successful',
      'done',
      'ready',
      'started',
      'running',
      'active',
      'healthy',
      'ok',
      '200',
      '201',
      '202',
    ],
  },
  {
    level: 'info',
    className: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500',
    patterns: [
      'info',
      'information',
      'debug',
      'trace',
      'log',
      'message',
      'event',
      'status',
      'update',
      'progress',
      'step',
      'stage',
      'phase',
      '📊',
      '📋',
      '🔗',
      '🏗️',
      '📡',
    ],
  },
];

/**
 * Detects the log level based on the content of a log message
 * @param logText - The log message text to analyze
 * @returns The detected log level
 */
export function detectLogLevel(logText: string): LogLevel {
  if (!logText) {
    return 'normal';
  }

  const normalizedText = logText.toLowerCase();

  // Create a list of all matches with their specificity (pattern length)
  const matches: Array<{ level: LogLevel; specificity: number; pattern: string }> = [];

  for (const config of LOG_LEVEL_CONFIGS) {
    for (const pattern of config.patterns) {
      const normalizedPattern = pattern.toLowerCase();

      if (normalizedText.includes(normalizedPattern)) {
        matches.push({
          level: config.level,
          specificity: normalizedPattern.length,
          pattern: normalizedPattern,
        });
      }
    }
  }

  if (matches.length === 0) {
    return 'normal';
  }

  // Sort by specificity (longer patterns first) and then by priority (error > warning > success > info)
  const levelPriority: Record<LogLevel, number> = {
    error: 0,
    warning: 1,
    success: 2,
    info: 3,
    normal: 4,
  };

  matches.sort((a, b) => {
    // First, prioritize by specificity (longer patterns are more specific)
    if (a.specificity !== b.specificity) {
      return b.specificity - a.specificity;
    }

    // If specificity is the same, prioritize by level importance
    return levelPriority[a.level] - levelPriority[b.level];
  });

  return matches[0].level;
}

/**
 * Gets the CSS class name for a given log level
 * @param level - The log level
 * @returns The corresponding CSS class string
 */
export function getLogLevelClassName(level: LogLevel): string {
  const config = LOG_LEVEL_CONFIGS.find((c) => c.level === level);
  return config?.className || 'text-bolt-elements-textPrimary';
}

/**
 * Gets both the log level and its CSS class in one call
 * @param logText - The log message text to analyze
 * @returns Object containing the level and className
 */
export function analyzeLogMessage(logText: string): { level: LogLevel; className: string } {
  const level = detectLogLevel(logText);
  const className = getLogLevelClassName(level);

  return { level, className };
}
