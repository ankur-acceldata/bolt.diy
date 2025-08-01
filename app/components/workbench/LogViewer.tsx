import { useEffect, useRef, useCallback, useState } from 'react';
import { classNames } from '~/utils/classNames';
import { useLogStream } from '~/lib/hooks/useLogStream';
import { analyzeLogMessage } from '~/utils/logLevelDetection';
import type { LogViewerProps } from '~/types/logStream';

export function LogViewer({
  dataplaneId,
  podName,
  isOpen,
  onClose,
  onSendMessage,
  onSetChatInput,
  model,
  provider,
}: LogViewerProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const autoSendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoSendCountRef = useRef<number>(0);
  const lastLogCountRef = useRef<number>(0);

  const [autoSendEnabled, setAutoSendEnabled] = useState(false);

  const { logs, isConnected, isConnecting, isInitializing, error, connect, clearLogs } = useLogStream({
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

  const sendLogsToChat = useCallback(
    (forceAutoSend = false) => {
      if (logs.length === 0) {
        return;
      }

      // Format logs for chat message
      const logMessages = logs
        .filter((entry) => !entry.keepAlive) // Filter out keep-alive messages
        .map((entry) => {
          const timestamp = new Date(entry.timestamp).toLocaleTimeString();
          const content = entry.error ? `[ERROR] ${entry.error}` : entry.log || '';

          return `[${timestamp}] ${content}`;
        })
        .join('\n');

      // Format the message properly with model/provider prefix for AI to understand
      const logContent = `I need help analyzing these execution logs from my application:\n\n**Pod:** ${podName}\n**Dataplane:** ${dataplaneId}\n\n\`\`\`\n${logMessages}\n\`\`\`\n\nPlease help me understand what's happening and suggest any fixes if there are errors.`;

      // Include model and provider context if available
      const messageContent =
        model && provider ? `[Model: ${model}]\n\n[Provider: ${provider}]\n\n${logContent}` : logContent;

      // Determine which mode to use
      const isAutoSendMode = forceAutoSend || autoSendEnabled;

      if (isAutoSendMode && onSendMessage) {
        // Auto-send mode: send message immediately
        onSendMessage(messageContent);

        // Increment auto-send count if this was an auto-send
        if (autoSendEnabled) {
          autoSendCountRef.current += 1;
        }
      } else if (!isAutoSendMode && onSetChatInput) {
        // Manual mode: just set the input text
        onSetChatInput(messageContent);
      }
    },
    [onSendMessage, onSetChatInput, logs, podName, dataplaneId, autoSendEnabled, model, provider],
  );

  // Auto-send logic
  const scheduleAutoSend = useCallback(() => {
    if (!autoSendEnabled || !onSendMessage || logs.length === 0 || autoSendCountRef.current >= 5) {
      return;
    }

    // Clear any existing timeout
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
    }

    // Schedule auto-send after 4-5 seconds of no new logs
    autoSendTimeoutRef.current = setTimeout(() => {
      sendLogsToChat(true); // Force auto-send mode
    }, 4500); // 4.5 seconds
  }, [autoSendEnabled, onSendMessage, logs.length, sendLogsToChat]);

  // Reset auto-send count when auto-send is toggled or logs are cleared
  const toggleAutoSend = useCallback(() => {
    setAutoSendEnabled(!autoSendEnabled);
    autoSendCountRef.current = 0;

    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }, [autoSendEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  // Handle auto-send when logs change
  useEffect(() => {
    const currentLogCount = logs.length;

    // If logs have increased and auto-send is enabled
    if (currentLogCount > lastLogCountRef.current && autoSendEnabled && autoSendCountRef.current < 5) {
      scheduleAutoSend();
    }

    lastLogCountRef.current = currentLogCount;
  }, [logs.length, autoSendEnabled, scheduleAutoSend]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="h-full bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-bolt-elements-textPrimary">Log Viewer</div>
            {dataplaneId && podName && (
              <div className="text-xs text-bolt-elements-textSecondary">
                {dataplaneId}/{podName}
              </div>
            )}
            <div className="relative">
              <div
                className={classNames(
                  'w-3 h-3 rounded-full transition-all duration-300',
                  isConnected
                    ? 'bg-green-500 shadow-green-500/50 shadow-md'
                    : isInitializing
                      ? 'bg-blue-500 animate-pulse shadow-blue-500/50 shadow-lg'
                      : isConnecting
                        ? 'bg-yellow-500 animate-pulse shadow-yellow-500/50 shadow-md'
                        : error
                          ? 'bg-red-500 animate-pulse shadow-red-500/50 shadow-md'
                          : 'bg-gray-500',
                )}
                title={
                  isConnected
                    ? 'Connected'
                    : isInitializing
                      ? 'Initializing - Waiting for backend to be ready'
                      : isConnecting
                        ? 'Connecting to stream'
                        : error
                          ? 'Connection Error'
                          : 'Stream Completed'
                }
              />
              {/* Animated ring for active states */}
              {(isInitializing || isConnecting) && (
                <div className="absolute inset-0 rounded-full animate-ping opacity-75">
                  <div
                    className={classNames(
                      'w-full h-full rounded-full',
                      isInitializing ? 'bg-blue-500/40' : 'bg-yellow-500/40',
                    )}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSendMessage && (
              <>
                <button
                  onClick={toggleAutoSend}
                  className={classNames(
                    'text-xs px-2 py-1 rounded transition-colors border',
                    autoSendEnabled
                      ? 'bg-green-500 hover:bg-green-600 text-white border-green-500'
                      : 'bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 text-bolt-elements-textSecondary border-bolt-elements-borderColor',
                  )}
                  title={
                    autoSendEnabled
                      ? `Auto-send enabled (${5 - autoSendCountRef.current} remaining)`
                      : 'Enable auto-send logs to chat'
                  }
                >
                  {autoSendEnabled ? '🔄 Auto' : 'Auto'}
                </button>
                <button
                  onClick={() => sendLogsToChat(false)} // Force manual mode
                  disabled={logs.length === 0}
                  className="text-xs px-2 py-1 bg-accent-500 hover:bg-accent-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={logs.length === 0 ? 'No logs to send' : 'Add logs to chat input'}
                >
                  Send to Chat
                </button>
              </>
            )}
            <button
              onClick={() => {
                clearLogs();
                autoSendCountRef.current = 0;
                lastLogCountRef.current = 0;

                if (autoSendTimeoutRef.current) {
                  clearTimeout(autoSendTimeoutRef.current);
                  autoSendTimeoutRef.current = null;
                }
              }}
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
              <div className="text-red-700 dark:text-red-400 text-sm text-center">
                <div className="mb-2">⚠ {error}</div>
                <button
                  onClick={connect}
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs transition-colors"
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
              {isInitializing ? (
                <div className="text-center mt-8">
                  {/* Main Loading Animation */}
                  <div className="relative inline-block mb-6">
                    {/* Outer rotating ring */}
                    <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full animate-spin">
                      <div className="w-full h-full border-4 border-transparent border-t-blue-500 rounded-full animate-pulse"></div>
                    </div>
                    {/* Inner pulsing dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-4 h-4 bg-blue-500 rounded-full animate-ping"></div>
                      <div className="absolute w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>

                  {/* Animated Text */}
                  <div className="space-y-3">
                    <div className="font-medium text-blue-400 text-lg animate-pulse">🏗️ Initializing Log Stream</div>
                    <div className="text-bolt-elements-textSecondary animate-pulse opacity-70">
                      Preparing backend connection...
                    </div>

                    {/* Animated dots */}
                    <div className="flex justify-center items-center gap-1 mt-4">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    </div>
                  </div>

                  {/* Background animated elements */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/5 rounded-full animate-pulse [animation-duration:3s]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-blue-400/5 rounded-full animate-pulse [animation-duration:4s] [animation-delay:1s]"></div>
                  </div>
                </div>
              ) : isConnecting && logs.length <= 1 ? (
                <div className="text-center mt-8">
                  <div className="relative inline-block mb-6">
                    <div className="w-12 h-12 border-4 border-yellow-500/30 rounded-full animate-spin">
                      <div className="w-full h-full border-4 border-transparent border-t-yellow-500 rounded-full"></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="font-medium text-yellow-400 animate-pulse">🔗 Connecting to Log Stream</div>
                  <div className="text-bolt-elements-textSecondary text-sm mt-2 opacity-70">
                    Establishing connection...
                  </div>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-bolt-elements-textSecondary text-center mt-8">
                  No logs available. Click "Reconnect" to start streaming.
                </div>
              ) : (
                logs.map((entry, index) => {
                  const logText = entry.error || entry.log || '';
                  const { className } = entry.error
                    ? {
                        className:
                          'bg-red-500/10 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-l-2 border-red-500',
                      }
                    : analyzeLogMessage(logText);

                  return (
                    <div key={index} className={classNames('mb-1 leading-relaxed px-2 py-1 rounded', className)}>
                      <span className="text-bolt-elements-textSecondary mr-2">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="whitespace-pre-wrap text-bolt-elements-textPrimary">{logText}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
