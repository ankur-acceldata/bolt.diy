/**
 * ============================================================================
 *                          APPLICATION LOGGER
 * ============================================================================
 *
 * A comprehensive logging system with support for multiple log levels,
 * scoped loggers, JSON formatting, and environment-based configuration.
 *
 * ============================================================================
 *                        LOG LEVEL CONFIGURATION
 * ============================================================================
 *
 * Set the log level using the VITE_LOG_LEVEL environment variable:
 *
 * 1. **Development (.env.development)**:
 *    ```
 *    VITE_LOG_LEVEL=debug
 *    ```
 *
 * 2. **Production (.env.production)**:
 *    ```
 *    VITE_LOG_LEVEL=info
 *    ```
 *
 * 3. **Testing (.env.test)**:
 *    ```
 *    VITE_LOG_LEVEL=warn
 *    ```
 *
 * 4. **Command Line Override**:
 *    ```bash
 *    VITE_LOG_LEVEL=error npm run dev
 *    ```
 *
 * ============================================================================
 *                           AVAILABLE LOG LEVELS
 * ============================================================================
 *
 * - **trace**   : Most verbose, trace-level debugging (rarely used)
 * - **debug**   : Detailed debugging info (development only)
 * - **info**    : Important runtime information (default for production)
 * - **warn**    : Warning messages (potential issues)
 * - **error**   : Error messages (actual problems)
 * - **none**    : Disable all logging
 *
 * ============================================================================
 *                              USAGE EXAMPLES
 * ============================================================================
 *
 * **Basic Usage**:
 * ```typescript
 * import { logger } from '~/utils/logger';
 *
 * logger.debug('Processing user input:', userInput);
 * logger.info('User authenticated:', userId);
 * logger.warn('Deprecated API used:', apiName);
 * logger.error('Failed to save data:', error);
 * ```
 *
 * **Scoped Logger** (Recommended):
 * ```typescript
 * import { createScopedLogger } from '~/utils/logger';
 *
 * const logger = createScopedLogger('UserService');
 *
 * logger.info('User created:', { userId, email });
 * logger.error('Database error:', error);
 * ```
 *
 * **Logging Objects/JSON**:
 * ```typescript
 * // Simple objects - automatically formatted as JSON
 * logger.info('User data:', { id: 123, name: 'John' });
 *
 * // Complex objects - pretty printed in development
 * logger.debug('Full state:', { users, settings, config });
 *
 * // Mixed string and objects
 * logger.info('Request completed:', requestId, { status, duration });
 * ```
 *
 * **Runtime Level Changes**:
 * ```typescript
 * import { logger } from '~/utils/logger';
 *
 * // Temporarily increase verbosity for debugging
 * logger.setLevel('debug');
 *
 * // Disable logging
 * logger.setLevel('none');
 * ```
 *
 * ============================================================================
 *                             BEST PRACTICES
 * ============================================================================
 *
 * ✅ DO:
 * - Use scoped loggers for better traceability
 * - Log objects directly (they'll be formatted automatically)
 * - Use appropriate log levels (error for errors, debug for verbose)
 * - Include context in log messages
 *
 * ❌ DON'T:
 * - Use console.log directly (use logger instead)
 * - Log sensitive data (passwords, tokens, PII)
 * - Stringify objects manually (logger handles it)
 * - Over-use error level for warnings
 *
 * ============================================================================
 */

export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'none';
import { Chalk } from 'chalk';

const chalk = new Chalk({ level: 3 });

type LoggerFunction = (...messages: any[]) => void;

interface Logger {
  trace: LoggerFunction;
  debug: LoggerFunction;
  info: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
  setLevel: (level: DebugLevel) => void;
}

/**
 * Initialize log level from environment variable or localStorage
 * Priority: localStorage > VITE_LOG_LEVEL > default (none)
 * Default: 'none' - logging is disabled by default for better performance
 */
let currentLevel: DebugLevel = (() => {
  // Try to get from localStorage first (for browser console persistence)
  if (typeof window !== 'undefined') {
    try {
      const savedLevel = localStorage.getItem('bolt_log_level') as DebugLevel | null;

      if (savedLevel && ['trace', 'debug', 'info', 'warn', 'error', 'none'].includes(savedLevel)) {
        return savedLevel;
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  // Fall back to environment variable or default (none)
  return import.meta.env.VITE_LOG_LEVEL || 'none';
})();

/**
 * Global logger instance
 *
 * @example
 * ```typescript
 * logger.info('Application started');
 * logger.error('Failed to load config:', error);
 * ```
 */
export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

/**
 * Create a scoped logger with a specific context
 *
 * @param scope - The scope/module name (e.g., 'UserService', 'AuthController')
 * @returns A logger instance with the specified scope
 *
 * @example
 * ```typescript
 * const logger = createScopedLogger('PaymentService');
 * logger.info('Payment processed:', { orderId, amount });
 * // Output: [INFO] [PaymentService] Payment processed: { orderId: 123, amount: 99.99 }
 * ```
 */
export function createScopedLogger(scope: string): Logger {
  return {
    trace: (...messages: any[]) => log('trace', scope, messages),
    debug: (...messages: any[]) => log('debug', scope, messages),
    info: (...messages: any[]) => log('info', scope, messages),
    warn: (...messages: any[]) => log('warn', scope, messages),
    error: (...messages: any[]) => log('error', scope, messages),
    setLevel,
  };
}

/**
 * Set the current log level at runtime
 *
 * @param level - The desired log level
 *
 * @example
 * ```typescript
 * // Enable verbose logging for debugging
 * logger.setLevel('debug');
 *
 * // Disable all logging
 * logger.setLevel('none');
 *
 * // Reset to production level
 * logger.setLevel('info');
 * ```
 */
function setLevel(level: DebugLevel) {
  // Prevent trace/debug in production builds for security
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    console.warn(`Cannot set log level to '${level}' in production build`);
    return;
  }

  const previousLevel = currentLevel;

  currentLevel = level;

  // Persist to localStorage for browser sessions
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('bolt_log_level', level);
      console.log(
        `%cLogger`,
        'background: #1389FD; color: white; padding: 2px 6px; border-radius: 3px;',
        `Log level changed: ${previousLevel} → ${level}`,
      );
    } catch {
      // Ignore localStorage errors
    }
  }
}

/**
 * Get the current log level
 *
 * @returns The current log level
 */
function getLevel(): DebugLevel {
  return currentLevel;
}

/**
 * Format a value for logging (handles objects, arrays, errors, etc.)
 */
function formatValue(value: any): string {
  // Handle null/undefined
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  // Handle errors specially
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack || ''}`;
  }

  // Handle primitives
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  // Handle objects and arrays - format as JSON
  try {
    // In development, use pretty printing
    if (import.meta.env.DEV) {
      return JSON.stringify(value, null, 2);
    }

    // In production, use compact JSON
    return JSON.stringify(value);
  } catch {
    // Fallback for circular references or non-serializable objects
    return String(value);
  }
}

/**
 * Core logging function
 */
function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'none'];

  // Check if current level allows this log
  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  // If current level is 'none', don't log anything
  if (currentLevel === 'none') {
    return;
  }

  // Format all messages, handling strings and objects
  const formattedMessages = messages.map((msg) => formatValue(msg));

  // Combine messages with proper spacing
  const allMessages = formattedMessages.reduce((acc, current) => {
    // Handle empty or undefined values
    if (!current) {
      return acc || '';
    }

    if (!acc) {
      return current;
    }

    // If current message is multiline (JSON), add newline before it
    if (current.includes('\n')) {
      return `${acc}\n${current}`;
    }

    // If accumulator ends with newline, don't add space
    if (acc.endsWith('\n')) {
      return acc + current;
    }

    return `${acc} ${current}`;
  }, '');

  const labelBackgroundColor = getColorForLevel(level);
  const labelTextColor = level === 'warn' ? '#000000' : '#FFFFFF';

  const labelStyles = getLabelStyles(labelBackgroundColor, labelTextColor);
  const scopeStyles = getLabelStyles('#77828D', 'white');

  const styles = [labelStyles];

  if (typeof scope === 'string') {
    styles.push('', scopeStyles);
  }

  let labelText = formatText(` ${level.toUpperCase()} `, labelTextColor, labelBackgroundColor);

  if (scope) {
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '#77828D')}`;
  }

  // Browser vs Node.js logging
  if (typeof window !== 'undefined') {
    // Browser: Use styled console output
    console.log(`%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`, ...styles, allMessages);
  } else {
    // Node.js: Use chalk for colored terminal output
    console.log(`${labelText}`, allMessages);
  }
}

/**
 * Format text with colors (for terminal output)
 */
function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

/**
 * Get CSS styles for browser console
 */
function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: white; border: 4px solid ${color}; color: ${textColor};`;
}

/**
 * Get color for each log level
 */
function getColorForLevel(level: DebugLevel): string {
  switch (level) {
    case 'trace':
    case 'debug': {
      return '#77828D';
    }
    case 'info': {
      return '#1389FD';
    }
    case 'warn': {
      return '#FFDB6C';
    }
    case 'error': {
      return '#EE4744';
    }
    default: {
      return '#000000';
    }
  }
}

/**
 * Pre-configured logger for render-related logs
 *
 * @example
 * ```typescript
 * renderLogger.trace('Component rendering:', componentName);
 * ```
 */
export const renderLogger = createScopedLogger('Render');

/**
 * Browser Console API for controlling logger
 * Available in browser console as: window.BoltLogger or just BoltLogger
 *
 * @example
 * ```javascript
 * // In browser console:
 * BoltLogger.help()              // Show available commands
 * BoltLogger.level()             // Get current level
 * BoltLogger.setLevel('debug')   // Enable debug logs
 * BoltLogger.setLevel('info')    // Show only info and above
 * BoltLogger.setLevel('error')   // Show only errors
 * BoltLogger.setLevel('none')    // Disable all logs
 * BoltLogger.reset()             // Reset to default level
 * ```
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
const BoltLogger = {
  /**
   * Get current log level
   */
  level: () => {
    const level = getLevel();

    console.log(
      `%cLogger`,
      'background: #1389FD; color: white; padding: 2px 6px; border-radius: 3px;',
      `Current log level: ${level}`,
    );

    return level;
  },

  /**
   * Set log level
   */
  setLevel: (level: DebugLevel) => {
    const validLevels: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'none'];

    if (!validLevels.includes(level)) {
      console.error(`Invalid log level: ${level}. Valid levels are:`, validLevels);

      return;
    }

    setLevel(level);
  },

  /**
   * Reset to default log level
   */
  reset: () => {
    const defaultLevel = import.meta.env.VITE_LOG_LEVEL || 'none';

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('bolt_log_level');
      } catch {
        // Ignore
      }
    }

    setLevel(defaultLevel as DebugLevel);
    console.log(
      `%cLogger`,
      'background: #1389FD; color: white; padding: 2px 6px; border-radius: 3px;',
      `Reset to default level: ${defaultLevel}`,
    );
  },

  /**
   * Show help information
   */
  help: () => {
    console.log(
      `
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
%c                    🚀 Bolt Logger Control                    
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%cAvailable Commands:
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  %cBoltLogger.level()%c
    Get the current log level

  %cBoltLogger.setLevel('debug')%c
    Set log level (trace, debug, info, warn, error, none)

  %cBoltLogger.reset()%c
    Reset to default log level

  %cBoltLogger.help()%c
    Show this help message

%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
%cLog Levels (from most to least verbose):
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  %ctrace%c   - Very verbose, includes all debug info
  %cdebug%c   - Detailed debugging information
  %cinfo%c    - General informational messages
  %cwarn%c    - Warning messages
  %cerror%c   - Error messages only
  %cnone%c    - Disable all logging (default)

%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
%cExamples:
%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  %c// Enable verbose debugging
  BoltLogger.setLevel('debug')

  // Show only warnings and errors
  BoltLogger.setLevel('warn')

  // Disable all logs
  BoltLogger.setLevel('none')

  // Check current level
  BoltLogger.level()

  // Reset to default
  BoltLogger.reset()%c

%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

%c💡 Tip: %cLog level changes persist across browser sessions!

%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `,
      'color: #1389FD; font-weight: bold;',
      'color: #1389FD; font-weight: bold; font-size: 16px;',
      'color: #1389FD; font-weight: bold;',
      'color: #FFDB6C; font-weight: bold; font-size: 14px;',
      'color: #1389FD; font-weight: bold;',
      'color: #00D9FF; font-family: monospace;',
      'color: #aaa;',
      'color: #00D9FF; font-family: monospace;',
      'color: #aaa;',
      'color: #00D9FF; font-family: monospace;',
      'color: #aaa;',
      'color: #00D9FF; font-family: monospace;',
      'color: #aaa;',
      'color: #1389FD; font-weight: bold;',
      'color: #FFDB6C; font-weight: bold; font-size: 14px;',
      'color: #1389FD; font-weight: bold;',
      'color: #77828D; font-weight: bold;',
      'color: #aaa;',
      'color: #77828D; font-weight: bold;',
      'color: #aaa;',
      'color: #1389FD; font-weight: bold;',
      'color: #aaa;',
      'color: #FFDB6C; font-weight: bold;',
      'color: #aaa;',
      'color: #EE4744; font-weight: bold;',
      'color: #aaa;',
      'color: #666; font-weight: bold;',
      'color: #aaa;',
      'color: #1389FD; font-weight: bold;',
      'color: #FFDB6C; font-weight: bold; font-size: 14px;',
      'color: #1389FD; font-weight: bold;',
      'color: #00D9FF; font-family: monospace; color: #aaa;',
      'color: #aaa;',
      'color: #1389FD; font-weight: bold;',
      'color: #FFDB6C; font-weight: bold;',
      'color: #aaa;',
      'color: #1389FD; font-weight: bold;',
    );
  },
};

// Expose to browser console (only in browser environment)
if (typeof window !== 'undefined') {
  (window as any).BoltLogger = BoltLogger;

  // Log initialization message in development
  if (import.meta.env.DEV) {
    console.log(
      `%c🚀 Bolt Logger`,
      'background: linear-gradient(90deg, #1389FD 0%, #00D9FF 100%); color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
      `initialized at level: ${currentLevel}`,
      '\nType %cBoltLogger.help()%c for available commands',
      'color: #00D9FF; font-family: monospace;',
      'color: inherit;',
    );
  }
}
