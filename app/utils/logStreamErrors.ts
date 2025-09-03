/**
 * Base class for all log streaming related errors
 */
export abstract class LogStreamError extends Error {
  readonly isRetryable: boolean;
  readonly statusCode?: number;

  constructor(message: string, isRetryable = false, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when pod is not found or unavailable
 */
export class PodNotFoundError extends LogStreamError {
  constructor(podName: string, dataplaneId: string) {
    super(
      `Pod "${podName}" not found in dataplane "${dataplaneId}". Please verify the pod name and dataplane ID.`,
      false,
      404,
    );
  }
}

/**
 * Error thrown when pod logs are temporarily unavailable
 */
export class PodUnavailableError extends LogStreamError {
  constructor(podName: string, statusCode: number) {
    super(
      `Pod logs unavailable (${statusCode}). The pod "${podName}" may have completed execution, been terminated, or not yet started. This is common for short-lived jobs.`,
      true,
      statusCode,
    );
  }
}

/**
 * Error thrown for server-side issues
 */
export class ServerError extends LogStreamError {
  constructor(statusCode: number, message?: string) {
    super(message || `Backend server error (${statusCode}). Please try again later.`, true, statusCode);
  }
}

/**
 * Error thrown for network connectivity issues
 */
export class NetworkError extends LogStreamError {
  constructor(originalError: Error) {
    super(`Network connection failed: ${originalError.message}`, true);
    this.cause = originalError;
  }
}

/**
 * Error thrown when authentication is missing or invalid
 */
export class AuthenticationError extends LogStreamError {
  constructor() {
    super('Authentication keys not configured. Please check your environment variables.', false, 401);
  }
}

/**
 * Error thrown when required parameters are missing
 */
export class ValidationError extends LogStreamError {
  constructor(missingParams: string[]) {
    super(`Missing required parameters: ${missingParams.join(', ')}`, false, 400);
  }
}

/**
 * Generic log stream error for cases not covered by specific error types
 */
export class GenericLogStreamError extends LogStreamError {
  constructor(message: string, isRetryable = false, statusCode?: number) {
    super(message, isRetryable, statusCode);
  }
}

/**
 * Factory function to create appropriate error based on response status
 */
export function createLogStreamError(
  statusCode: number,
  responseText: string,
  podName?: string,
  dataplaneId?: string,
): LogStreamError {
  switch (statusCode) {
    case 404:
      return new PodNotFoundError(podName || 'unknown', dataplaneId || 'unknown');

    case 502:
      return new PodUnavailableError(podName || 'unknown', statusCode);

    case 401:
    case 403:
      return new AuthenticationError();

    default:
      if (statusCode >= 500) {
        return new ServerError(statusCode, responseText);
      }

      return new GenericLogStreamError(
        `Failed to connect to log stream: ${statusCode} - ${responseText}`,
        statusCode >= 500,
      );
  }
}
