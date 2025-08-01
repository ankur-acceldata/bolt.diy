/**
 * Represents a single log entry in the stream
 */
export interface LogEntry {
  /** The actual log message content */
  log?: string;

  /** Error message if this entry represents an error */
  error?: string;

  /** ISO timestamp when this entry was created */
  timestamp: string;

  /** Whether this is a keep-alive message (should not be displayed) */
  keepAlive?: boolean;
}

/**
 * Configuration options for the log stream hook
 */
export interface LogStreamOptions {
  /** The dataplane ID to stream logs from */
  dataplaneId?: string;

  /** The specific pod name to monitor */
  podName?: string;

  /** Whether the log stream should be active */
  enabled?: boolean;

  /** Number of recent log lines to retrieve */
  tailLines?: number;

  /** Delay in milliseconds before starting the first connection attempt */
  initialDelay?: number;
}

/**
 * Return type for the useLogStream hook
 */
export interface LogStreamState {
  /** Array of all log entries received */
  logs: LogEntry[];

  /** Whether currently connected to the stream */
  isConnected: boolean;

  /** Whether attempting to connect */
  isConnecting: boolean;

  /** Whether in initial delay period before first connection */
  isInitializing: boolean;

  /** Current error message, if any */
  error: string | null;

  /** Function to manually initiate connection */
  connect: () => void;

  /** Function to disconnect from the stream */
  disconnect: () => void;

  /** Function to clear all current logs */
  clearLogs: () => void;
}

/**
 * Props for the LogViewer component
 */
export interface LogViewerProps {
  /** The dataplane ID to stream logs from */
  dataplaneId?: string;

  /** The specific pod name to monitor */
  podName?: string;

  /** Whether the log viewer is open/visible */
  isOpen: boolean;

  /** Callback when the viewer is closed */
  onClose: () => void;

  /** Callback to send a message to chat (auto-send mode) */
  onSendMessage?: (message: string) => void;

  /** Callback to set input text in chat box (manual mode) */
  onSetChatInput?: (message: string) => void;

  /** Current model for proper message formatting */
  model?: string;

  /** Current provider for proper message formatting */
  provider?: string;
}

/**
 * Configuration constants for log streaming
 */
export const LOG_STREAM_CONSTANTS = {
  /** Default number of log lines to retrieve */
  DEFAULT_TAIL_LINES: 100,

  /** Keep-alive interval in milliseconds */
  KEEP_ALIVE_INTERVAL: 30000,

  /** Default initialization delay before first connection attempt (ms) */
  DEFAULT_INITIAL_DELAY: 10000,

  /** Maximum retry attempts for failed connections */
  MAX_RETRY_ATTEMPTS: 3,

  /** Base delay for exponential backoff (ms) */
  RETRY_BASE_DELAY: 1000,

  /** Maximum retry delay (ms) */
  MAX_RETRY_DELAY: 5000,

  /** Connection timeout (ms) */
  CONNECTION_TIMEOUT: 30000,
} as const;
