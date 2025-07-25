import { useEffect, useRef, useState, useCallback } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useLogStream');

interface LogEntry {
  log?: string;
  error?: string;
  timestamp: string;
  keepAlive?: boolean;
}

interface UseLogStreamOptions {
  dataplaneId?: string;
  podName?: string;
  enabled?: boolean;
  tailLines?: number;
}

interface UseLogStreamReturn {
  logs: LogEntry[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  clearLogs: () => void;
}

export function useLogStream({
  dataplaneId,
  podName,
  enabled = false,
  tailLines = 100,
}: UseLogStreamOptions): UseLogStreamReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      logger.info('Disconnecting from log stream');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!dataplaneId || !podName) {
      const errorMsg = 'Missing dataplane ID or pod name';
      logger.error(errorMsg);
      setError(errorMsg);

      return;
    }

    if (eventSourceRef.current) {
      disconnect();
    }

    setIsConnecting(true);
    setError(null);

    try {
      /*
       * Use the proxy API route that handles authentication headers
       * Construct absolute URL based on current location to avoid routing issues
       */
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const url = `${baseUrl}/ai-editor/api/log-stream?dataplaneId=${encodeURIComponent(dataplaneId)}&podName=${encodeURIComponent(podName)}&tailLines=${tailLines}`;

      logger.info('Connecting to log stream:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        logger.info('Log stream connected successfully');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        logger.debug('Received log message:', event.data);

        try {
          const data: LogEntry = JSON.parse(event.data);

          // Don't show keep-alive messages to user, but log them for debugging
          if (data.keepAlive) {
            logger.debug('Received keep-alive message');

            return;
          }

          setLogs((prevLogs) => [...prevLogs, data]);
        } catch (err) {
          logger.error('Failed to parse log data:', err, 'Raw data:', event.data);

          // Add unparseable data as a log entry
          setLogs((prevLogs) => [
            ...prevLogs,
            {
              log: `[Parse Error] ${event.data}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      };

      eventSource.onerror = (event) => {
        logger.error('EventSource error event:', event);
        logger.error('EventSource readyState:', eventSource.readyState);

        const readyStateMap = {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSED',
        };

        const readyStateText = readyStateMap[eventSource.readyState as keyof typeof readyStateMap] || 'UNKNOWN';
        const errorMsg = `Connection to log stream failed (readyState: ${eventSource.readyState} - ${readyStateText})`;

        logger.error(errorMsg);
        setError(errorMsg);
        setIsConnected(false);
        setIsConnecting(false);

        // Add error as a log entry for user visibility
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            error: errorMsg,
            timestamp: new Date().toISOString(),
          },
        ]);

        eventSource.close();
      };
    } catch (err) {
      logger.error('Failed to connect to log stream:', err);

      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to log stream';
      setError(errorMsg);
      setIsConnecting(false);

      // Add error as a log entry for user visibility
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          error: errorMsg,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [dataplaneId, podName, tailLines, disconnect]);

  const clearLogs = useCallback(() => {
    logger.info('Clearing logs');
    setLogs([]);
  }, []);

  useEffect(() => {
    logger.info('useLogStream effect triggered:', { enabled, dataplaneId, podName });

    if (enabled && dataplaneId && podName) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, dataplaneId, podName, connect, disconnect]);

  return {
    logs,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    clearLogs,
  };
}
