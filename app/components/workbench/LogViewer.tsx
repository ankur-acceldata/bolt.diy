import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { useLogStream } from '~/lib/hooks/useLogStream';

interface LogViewerProps {
  dataplaneId?: string;
  podName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LogViewer({ dataplaneId, podName, isOpen, onClose }: LogViewerProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { logs, isConnected, isConnecting, error, connect, clearLogs } = useLogStream({
    dataplaneId,
    podName,
    enabled: isOpen,
    tailLines: 100,
  });

  const scrollToBottom = useCallback(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: isOpen ? 'auto' : 0 }}
      className="bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor"
    >
      <div className="h-80 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-bolt-elements-textPrimary">Log Viewer</div>
            {dataplaneId && podName && (
              <div className="text-xs text-bolt-elements-textSecondary">
                {dataplaneId}/{podName}
              </div>
            )}
            <div
              className={classNames(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500',
              )}
              title={isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected'}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearLogs}
              className="text-xs px-2 py-1 bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary rounded transition-colors"
              title="Clear logs"
            >
              Clear
            </button>
            <button
              onClick={connect}
              disabled={isConnecting}
              className="text-xs px-2 py-1 bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary rounded transition-colors disabled:opacity-50"
              title="Reconnect"
            >
              {isConnecting ? 'Connecting...' : 'Reconnect'}
            </button>
            <button
              onClick={onClose}
              className="text-xs px-2 py-1 bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary rounded transition-colors"
              title="Close log viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-red-500 text-sm text-center">
                <div className="mb-2">⚠ {error}</div>
                <button
                  onClick={connect}
                  className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div
              ref={logContainerRef}
              className="h-full overflow-y-auto p-2 font-mono text-xs bg-bolt-elements-background-depth-1"
            >
              {logs.length === 0 && !isConnecting ? (
                <div className="text-bolt-elements-textSecondary text-center mt-8">
                  No logs available. Click "Reconnect" to start streaming.
                </div>
              ) : (
                logs.map((entry, index) => (
                  <div
                    key={index}
                    className={classNames(
                      'mb-1 leading-relaxed',
                      entry.error ? 'text-red-400' : 'text-bolt-elements-textPrimary',
                    )}
                  >
                    <span className="text-bolt-elements-textSecondary mr-2">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="whitespace-pre-wrap">{entry.error || entry.log}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
