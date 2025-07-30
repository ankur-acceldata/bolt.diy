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
      'exit code]: -1',
      'status: failed',
      'execution completed with status failed',
      'error reading stderr',
      'error streaming logs',
      '"error":',
      'exception',
      'fatal',
      'critical',
      'stack trace',
      'traceback',
    ],
  },
  {
    level: 'warning',
    className:
      'bg-yellow-500/10 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-l-2 border-yellow-500',
    patterns: ['warning', 'warn', 'deprecated', 'status: echo_failed', 'caution', 'notice'],
  },
  {
    level: 'success',
    className: 'bg-green-500/10 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-l-2 border-green-500',
    patterns: [
      '✅',
      '🎉',
      'success',
      'completed successfully',
      'all tests passed',
      'log stream completed',
      'execution completed',
      'build succeeded',
    ],
  },
  {
    level: 'info',
    className: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500',
    patterns: ['info', '📊', '📋', '🔗', '🏗️', '📡', 'debug', 'trace'],
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

  for (const config of LOG_LEVEL_CONFIGS) {
    for (const pattern of config.patterns) {
      if (normalizedText.includes(pattern.toLowerCase())) {
        return config.level;
      }
    }
  }

  return 'normal';
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
