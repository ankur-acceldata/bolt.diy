/**
 * Timeout constants for various operations in the application
 */
export const TIMEOUT_CONSTANTS = {
  /** Default timeout for chat requests (5 minutes) */
  CHAT_REQUEST_TIMEOUT: 300000,

  /** Keep-alive interval for streaming requests (25 seconds) */
  KEEP_ALIVE_INTERVAL: 25000,

  /** Maximum idle time before cleaning up resources (5 minutes) */
  MAX_IDLE_TIME: 300000,

  /** Default timeout for API requests (30 seconds) */
  DEFAULT_API_TIMEOUT: 30000,

  /** Timeout for health checks (5 seconds) */
  HEALTH_CHECK_TIMEOUT: 5000,

  /** Timeout for log stream connections (30 seconds) */
  LOG_STREAM_TIMEOUT: 30000,
} as const;

/**
 * Helper function to create an AbortSignal with timeout
 */
export function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Helper function to create a timeout promise
 */
export function createTimeoutPromise<T>(timeoutMs: number, errorMessage?: string): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}
