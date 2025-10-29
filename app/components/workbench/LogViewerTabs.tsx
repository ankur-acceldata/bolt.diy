import { useStore } from '@nanostores/react';
import React, { memo, useRef, useEffect } from 'react';
import { Panel, type ImperativePanelHandle } from 'react-resizable-panels';
import { IconButton } from '~/components/ui/IconButton';
import { logViewerStore } from '~/lib/stores/logViewer';
import { classNames } from '~/utils/classNames';
import { LogViewer } from './LogViewer';

export const DEFAULT_LOG_VIEWER_SIZE = 30;

interface LogViewerTabsProps {
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
}

export const LogViewerTabs = memo(({ onSendMessage, onSetChatInput }: LogViewerTabsProps) => {
  const showLogViewerPanel = useStore(logViewerStore.showLogViewerPanel);
  const logViewerInstances = useStore(logViewerStore.logViewerInstances);
  const activeLogViewerId = useStore(logViewerStore.activeLogViewerId);

  const logViewerPanelRef = useRef<ImperativePanelHandle>(null);

  // Expand panel when showLogViewerPanel becomes true
  useEffect(() => {
    if (showLogViewerPanel && logViewerPanelRef.current) {
      logViewerPanelRef.current.expand();
    } else if (!showLogViewerPanel && logViewerPanelRef.current) {
      logViewerPanelRef.current.collapse();
    }
  }, [showLogViewerPanel]);

  const handleCloseLogViewer = (id: string) => {
    logViewerStore.closeLogViewerInstance(id);
  };

  const handleCloseAllLogViewers = () => {
    logViewerStore.closeAllLogViewerInstances();
  };

  const handleMinimize = () => {
    logViewerStore.toggleLogViewerPanel(false);
  };

  if (logViewerInstances.length === 0) {
    return null;
  }

  return (
    <Panel
      ref={logViewerPanelRef}
      defaultSize={showLogViewerPanel ? DEFAULT_LOG_VIEWER_SIZE : 0}
      minSize={10}
      collapsible
      onExpand={() => {
        logViewerStore.toggleLogViewerPanel(true);
      }}
      onCollapse={() => {
        logViewerStore.toggleLogViewerPanel(false);
      }}
    >
      <div className={classNames('h-full', { hidden: !showLogViewerPanel })}>
        <div className="bg-bolt-elements-background-depth-1 h-full flex flex-col">
          {/* Tab Bar */}
          <div className="flex items-center bg-bolt-elements-background-depth-2 border-t border-b border-bolt-elements-borderColor gap-0 min-h-[34px] overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-bolt-elements-borderColor scrollbar-track-transparent hover:scrollbar-thumb-bolt-elements-textTertiary">
            {/* Log Viewer Tabs */}
            {logViewerInstances.map((instance) => {
              const isActive = activeLogViewerId === instance.id;

              return (
                <React.Fragment key={instance.id}>
                  <button
                    className={classNames(
                      'group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all duration-150 flex-shrink-0 min-w-[150px] max-w-[220px] border-r border-bolt-elements-borderColor',
                      isActive
                        ? 'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary shadow-sm'
                        : 'bg-transparent text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary',
                    )}
                    onClick={() => logViewerStore.setActiveLogViewerInstance(instance.id)}
                    title={instance.title}
                  >
                    {/* Log viewer icon */}
                    <span
                      className={classNames('i-ph:terminal-window-duotone shrink-0 text-base', {
                        'text-bolt-elements-textPrimary': isActive,
                        'text-bolt-elements-textTertiary group-hover:text-bolt-elements-textSecondary': !isActive,
                      })}
                    />

                    {/* Log viewer title */}
                    <span className="truncate flex-1 text-left">{instance.title}</span>

                    {/* Close button */}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseLogViewer(instance.id);
                      }}
                      className={classNames(
                        'i-ph:x text-base p-0.5 rounded transition-all duration-150 shrink-0',
                        'hover:bg-bolt-elements-background-depth-4',
                        {
                          'opacity-100 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary': isActive,
                          'opacity-0 group-hover:opacity-100 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
                            !isActive,
                        },
                      )}
                      title="Close log viewer"
                    />

                    {/* Active tab indicator */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bolt-elements-item-contentAccent" />
                    )}
                  </button>
                </React.Fragment>
              );
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              <IconButton
                icon="i-ph:minus"
                title="Minimize"
                onClick={handleMinimize}
                className="hover:bg-bolt-elements-item-backgroundActive"
              />
              <IconButton
                icon="i-ph:x-circle"
                title="Close All"
                onClick={handleCloseAllLogViewers}
                className="hover:bg-bolt-elements-item-backgroundActive"
              />
            </div>
          </div>

          {/* Log Viewer Content */}
          <div className="flex-1 overflow-hidden relative">
            {logViewerInstances.map((instance, index) => {
              const isActive = activeLogViewerId === instance.id;
              const isLatest = index === logViewerInstances.length - 1;

              return (
                <div
                  key={instance.id}
                  className={classNames('absolute inset-0 h-full w-full', isActive ? 'block z-10' : 'hidden z-0')}
                >
                  <LogViewer
                    dataplaneId={instance.dataplaneId}
                    runId={instance.runId}
                    isOpen={true}
                    isLatest={isLatest}
                    onClose={() => handleCloseLogViewer(instance.id)}
                    onSendMessage={onSendMessage}
                    onSetChatInput={onSetChatInput}
                    isPipeline={instance.isPipeline}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
});

LogViewerTabs.displayName = 'LogViewerTabs';
