/**
 * Enhanced logging utility with environment-aware log levels and rich data type support
 *
 * Features:
 * - Supports all data types: objects, arrays, functions, primitives, etc.
 * - Styled console output in browser with color-coded log levels
 * - Server-side chalk formatting for Node.js environments
 * - Environment-aware log level defaults
 *
 * Usage examples:
 * logger.info('Simple message');
 * logger.debug('User data:', { id: 1, name: 'John' });
 * logger.error('Error with context:', error, { userId: 123, action: 'save' });
 * logger.warn('Mixed data:', 'string', [1, 2, 3], { key: 'value' });
 *
 * Default behavior:
 * - Development Server: Shows 'debug' level and above
 * - Production Server: Shows 'warn' level and above
 * - UI/Browser: Shows 'error' level only by default (clean console)
 *
 * Environment variable controls:
 * VITE_LOG_LEVEL=debug       - Set explicit log level (overrides defaults)
 * VITE_DISABLE_LOGGING=true  - Disable all logging except errors (works in dev too)
 *
 * Examples:
 * VITE_LOG_LEVEL=debug npm run build     - Enable debug logs in production
 * VITE_LOG_LEVEL=debug npm run dev       - Enable debug logs in UI console
 * VITE_DISABLE_LOGGING=true npm run dev  - Disable all logging except errors
 * VITE_LOG_LEVEL=info npm run dev        - Show info+ logs in UI console
 *
 * Runtime control in browser console:
 * window.enableDebugLogging('debug')  // Enable debug logging
 * window.disableDebugLogging()        // Back to error-only
 * window.setLogLevel('info')           // Set specific level
 */

export type DebugLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
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

// Determine initial log level based on environment
const getInitialLogLevel = (): DebugLevel => {
  // Check for explicit log level override
  if (import.meta.env.VITE_LOG_LEVEL) {
    return import.meta.env.VITE_LOG_LEVEL as DebugLevel;
  }

  // Check for disabled logging environment variable
  if (import.meta.env.VITE_DISABLE_LOGGING === 'true') {
    return 'error'; // Only show errors when logging is disabled
  }

  // In browser/UI, be restrictive by default (only errors) unless explicitly enabled
  if (typeof window !== 'undefined') {
    return 'error'; // UI console disabled by default - use runtime controls to enable
  }

  // Server-side logging behavior
  if (import.meta.env.PROD) {
    // On server-side production, show warnings and errors
    return 'warn';
  }

  // In development server, show debug and above by default
  return 'debug';
};

let currentLevel: DebugLevel = getInitialLogLevel();

export const logger: Logger = {
  trace: (...messages: any[]) => log('trace', undefined, messages),
  debug: (...messages: any[]) => log('debug', undefined, messages),
  info: (...messages: any[]) => log('info', undefined, messages),
  warn: (...messages: any[]) => log('warn', undefined, messages),
  error: (...messages: any[]) => log('error', undefined, messages),
  setLevel,
};

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

function setLevel(level: DebugLevel) {
  if ((level === 'trace' || level === 'debug') && import.meta.env.PROD) {
    return;
  }

  currentLevel = level;
}

function log(level: DebugLevel, scope: string | undefined, messages: any[]) {
  const levelOrder: DebugLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

  // Check if logging is completely disabled via environment variable
  if (import.meta.env.VITE_DISABLE_LOGGING === 'true' && !import.meta.env.VITE_LOG_LEVEL) {
    // Only allow errors when logging is explicitly disabled
    if (level !== 'error') {
      return;
    }
  }

  // Early return if log level is too low
  if (levelOrder.indexOf(level) < levelOrder.indexOf(currentLevel)) {
    return;
  }

  // In browser/UI, be restrictive by default unless explicitly overridden
  if (typeof window !== 'undefined') {
    // Only allow error level in UI unless explicitly overridden by env var
    if (!import.meta.env.VITE_LOG_LEVEL && level !== 'error') {
      return;
    }
  }

  // Handle different types of messages properly - don't stringify everything
  const processedMessages = messages.map((msg) => {
    // Keep objects, arrays, functions, etc. as-is for proper console display
    if (typeof msg === 'object' || typeof msg === 'function' || Array.isArray(msg)) {
      return msg;
    }

    // Convert primitives to strings for concatenation where needed
    return String(msg);
  });

  // Create a single message string only for the prefixes, keep objects separate
  const stringMessages = processedMessages.filter((msg) => typeof msg === 'string');
  const nonStringMessages = processedMessages.filter((msg) => typeof msg !== 'string');

  const combinedStringMessage = stringMessages.length > 0 ? stringMessages.join(' ') : '';
  const allMessages = combinedStringMessage;

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
    labelText = `${labelText} ${formatText(` ${scope} `, '#FFFFFF', '77828D')}`;
  }

  if (typeof window !== 'undefined') {
    // Browser: Use styled console with proper object handling
    if (nonStringMessages.length > 0) {
      // When we have objects/arrays, log them separately to preserve their structure
      console.log(
        `%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`,
        ...styles,
        allMessages,
        ...nonStringMessages,
      );
    } else {
      // Only strings, use the original format
      console.log(`%c${level.toUpperCase()}${scope ? `%c %c${scope}` : ''}`, ...styles, allMessages);
    }
  } else {
    // Server/Node: Use chalk formatting with proper object handling
    if (nonStringMessages.length > 0) {
      // When we have objects/arrays, log them separately to preserve their structure
      console.log(`${labelText}`, allMessages, ...nonStringMessages);
    } else {
      // Only strings, use the original format
      console.log(`${labelText}`, allMessages);
    }
  }
}

function formatText(text: string, color: string, bg: string) {
  return chalk.bgHex(bg)(chalk.hex(color)(text));
}

function getLabelStyles(color: string, textColor: string) {
  return `background-color: ${color}; color: white; border: 4px solid ${color}; color: ${textColor};`;
}

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
 * Enable client-side logging for debugging purposes.
 * This can be called from browser console: window.enableDebugLogging()
 *
 * @param level - The log level to set ('trace', 'debug', 'info', 'warn', 'error')
 */
export function enableDebugLogging(level: DebugLevel = 'debug') {
  if (typeof window !== 'undefined') {
    currentLevel = level;
    console.log(`%cLogging enabled at level: ${level}`, 'color: #1389FD; font-weight: bold;');
  }
}

/**
 * Disable client-side logging (errors only)
 */
export function disableDebugLogging() {
  if (typeof window !== 'undefined') {
    currentLevel = 'error';
    console.log(`%cLogging disabled (errors only)`, 'color: #EE4744; font-weight: bold;');
  }
}

/**
 * Set a specific log level
 * @param level - The log level to set
 */
export function setLogLevel(level: DebugLevel) {
  if (typeof window !== 'undefined') {
    currentLevel = level;
    console.log(`%cLog level set to: ${level}`, 'color: #FFDB6C; font-weight: bold;');
  }
}

/**
 * Get the current log level
 */
export function getCurrentLogLevel(): DebugLevel {
  return currentLevel;
}

// Cross-frame logger communication using localStorage and postMessage
const LOGGER_STORAGE_KEY = 'bolt_logger_level';
const LOGGER_MESSAGE_TYPE = 'BOLT_LOGGER_CONTROL';

// Function to sync log level from localStorage
function syncLogLevelFromStorage(): void {
  try {
    const storedLevel = localStorage.getItem(LOGGER_STORAGE_KEY);

    if (storedLevel && ['trace', 'debug', 'info', 'warn', 'error'].includes(storedLevel)) {
      currentLevel = storedLevel as DebugLevel;
    }
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Function to save log level to localStorage and broadcast to other frames
function setLogLevelGlobally(level: DebugLevel): void {
  currentLevel = level;

  try {
    localStorage.setItem(LOGGER_STORAGE_KEY, level);

    // Broadcast to all frames via postMessage
    const message = { type: LOGGER_MESSAGE_TYPE, action: 'setLevel', level };

    // Try to send to parent
    try {
      if (window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
    } catch {
      // Ignore cross-origin errors
    }

    // Try to send to all child frames
    try {
      for (let i = 0; i < window.frames.length; i++) {
        try {
          window.frames[i].postMessage(message, '*');
        } catch {
          // Ignore cross-origin errors for individual frames
        }
      }
    } catch {
      // Ignore if frames access is restricted
    }

    // Try to send to top window
    try {
      if (window.top && window.top !== window) {
        window.top.postMessage(message, '*');
      }
    } catch {
      // Ignore cross-origin errors
    }
  } catch {
    // Silently fail if localStorage is not available
  }
}

// Make functions available globally for browser console debugging
if (typeof window !== 'undefined') {
  // Check if we're in the top-level window (not an iframe)
  const isTopWindow = window === window.top;

  // Sync log level from storage on load
  syncLogLevelFromStorage();

  // Listen for log level changes from other frames
  window.addEventListener('message', (event) => {
    if (event.data?.type === LOGGER_MESSAGE_TYPE && event.data?.action === 'setLevel') {
      const newLevel = event.data.level;

      if (['trace', 'debug', 'info', 'warn', 'error'].includes(newLevel)) {
        currentLevel = newLevel;
      }
    }
  });

  // Enhanced functions that work across frames
  const enhancedEnableDebugLogging = (level: DebugLevel = 'debug') => {
    setLogLevelGlobally(level);
    console.log(`%cLogging enabled at level: ${level} (across all frames)`, 'color: #1389FD; font-weight: bold;');
  };

  const enhancedDisableDebugLogging = () => {
    setLogLevelGlobally('error');
    console.log(`%cLogging disabled (errors only, across all frames)`, 'color: #EE4744; font-weight: bold;');
  };

  const enhancedSetLogLevel = (level: DebugLevel) => {
    setLogLevelGlobally(level);
    console.log(`%cLog level set to: ${level} (across all frames)`, 'color: #FFDB6C; font-weight: bold;');
  };

  // Always make functions available on the current window
  (window as any).enableDebugLogging = enhancedEnableDebugLogging;
  (window as any).disableDebugLogging = enhancedDisableDebugLogging;
  (window as any).setLogLevel = enhancedSetLogLevel;
  (window as any).getCurrentLogLevel = getCurrentLogLevel;

  // Also create a logger object for easier access
  (window as any).logger = {
    enableDebugLogging: enhancedEnableDebugLogging,
    disableDebugLogging: enhancedDisableDebugLogging,
    setLogLevel: enhancedSetLogLevel,
    getCurrentLogLevel,
    help: () => {
      console.log(
        `
%c🔧 Logger Controls Available (Cross-Frame):

%cDirect Functions:%c
enableDebugLogging('debug') %c- Enable debug logging (all frames)
disableDebugLogging()       %c- Back to error-only (all frames)
setLogLevel('info')         %c- Set specific level (all frames)
getCurrentLogLevel()        %c- Check current level

%cVia logger object:%c
logger.enableDebugLogging('debug')
logger.disableDebugLogging()
logger.setLogLevel('info')
logger.getCurrentLogLevel()
logger.help()

%cAvailable levels:%c trace, debug, info, warn, error

%cNote:%c Changes apply to ALL frames (main window + iframes)
      `,
        'color: #1389FD; font-weight: bold; font-size: 14px;',
        'color: #FFDB6C; font-weight: bold;',
        'color: inherit;',
        'color: #888;',
        'color: #888;',
        'color: #888;',
        'color: #888;',
        'color: #FFDB6C; font-weight: bold;',
        'color: inherit;',
        'color: #FFDB6C; font-weight: bold;',
        'color: inherit;',
        'color: #00C851; font-weight: bold;',
        'color: inherit;',
      );
    },
  };

  // Only log the welcome message in the top-level window to avoid spam
  if (isTopWindow) {
    console.log(
      '%c🔧 Logger Controls Loaded (Cross-Frame)!%c Type %clogger.help()%c for controls that work across all frames',
      'color: #1389FD; font-weight: bold;',
      'color: inherit;',
      'color: #FFDB6C; font-weight: bold;',
      'color: inherit;',
    );
  }
}

export const renderLogger = createScopedLogger('Render');
