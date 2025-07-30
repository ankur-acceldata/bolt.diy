import { useEffect, useRef, useState, useCallback } from 'react';
import { createScopedLogger } from '~/utils/logger';
import { getBasePath } from '~/utils/api';
import type { LogEntry, LogStreamOptions, LogStreamState } from '~/types/logStream';
import { LOG_STREAM_CONSTANTS } from '~/types/logStream';

const logger = createScopedLogger('useLogStream');

export function useLogStream({
  dataplaneId,
  podName,
  enabled = false,
  tailLines = LOG_STREAM_CONSTANTS.DEFAULT_TAIL_LINES,
  initialDelay = LOG_STREAM_CONSTANTS.DEFAULT_INITIAL_DELAY,
}: LogStreamOptions): LogStreamState {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasReceivedDataRef = useRef<boolean>(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      logger.info('Disconnecting from log stream');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (initializationTimeoutRef.current) {
      logger.info('Clearing initialization timeout');
      clearTimeout(initializationTimeoutRef.current);
      initializationTimeoutRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setIsInitializing(false);
  }, []);

  const connectToStream = useCallback(() => {
    if (!dataplaneId || !podName) {
      const errorMsg = 'Missing dataplane ID or pod name';
      logger.error(errorMsg);
      setError(errorMsg);

      return;
    }

    logger.info('Starting actual connection to log stream...');
    setIsInitializing(false);
    setIsConnecting(true);
    setError(null);
    hasReceivedDataRef.current = false; // Reset for new connection

    try {
      /*
       * Use the proxy API route that handles authentication headers
       * Construct absolute URL based on current location to avoid routing issues
       */
      const baseUrl = `${window.location.protocol}//${window.location.host}`;
      const basePath = getBasePath();
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const url = `${baseUrl}${cleanBasePath}/api/log-stream?dataplaneId=${encodeURIComponent(dataplaneId)}&podName=${encodeURIComponent(podName)}&tailLines=${tailLines}`;

      logger.info('🔗 Connecting to log stream:', url);

      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      // Add more detailed error logging
      eventSource.addEventListener('error', (e) => {
        logger.error('🚨 EventSource raw error event:', e);
      });

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

          // Mark that we've received data
          hasReceivedDataRef.current = true;

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

        // Check if this is a normal stream completion vs actual error
        logger.info(`EventSource error - readyState: ${eventSource.readyState}, logs.length: ${logs.length}`);

        /*
         * Use ref to track if we received any messages during this session
         * This avoids race conditions with state updates
         */
        if (hasReceivedDataRef.current) {
          // Stream ended after receiving data - this is normal for completed pods
          logger.info('🎉 FIXED: Log stream completed normally (pod execution finished)');
          setIsConnected(false);
          setIsConnecting(false);
          setError(null); // Clear any previous errors

          // Add a completion message for user visibility
          setLogs((prevLogs) => [
            ...prevLogs,
            {
              log: `✅ Log stream completed - Pod "${podName}" finished execution`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          // This is an actual error (connection failed, timeout, etc.)
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
        }

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

    // Start initialization phase
    setIsInitializing(true);
    setError(null);

    // Add initialization message to logs
    setLogs((prevLogs) => [
      ...prevLogs,
      {
        log: `🏗️ Initializing log stream for ${dataplaneId}/${podName}...`,
        timestamp: new Date().toISOString(),
      },
    ]);

    logger.info(`Starting initialization delay of ${initialDelay}ms before connecting...`);

    // Set timeout for delayed connection
    initializationTimeoutRef.current = setTimeout(() => {
      connectToStream();
    }, initialDelay);
  }, [dataplaneId, podName, initialDelay, disconnect, connectToStream]);

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
    isInitializing,
    error,
    connect,
    disconnect,
    clearLogs,
  };
}
