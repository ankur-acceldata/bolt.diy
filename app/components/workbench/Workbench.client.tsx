import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { ButtonDropdown } from '~/components/ui/ButtonDropdown';
import { Slider } from '~/components/ui/Slider';
import { StatusIndicator } from '~/components/ui/StatusIndicator';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { DiffView } from './DiffView';
import { FileModifiedDropdown } from './FileModifiedDropdown';
import useViewport from '~/lib/hooks';
import { PushToGitHubDialog } from '~/components/@settings/tabs/connections/components/PushToGitHubDialog';
import { usePreviewStore } from '~/lib/stores/previews';
import { chatStore } from '~/lib/stores/chat';
import { useSync } from '~/lib/hooks/useSync';
import { useSettings } from '~/lib/hooks/useSettings';
import { debugProjectId } from '~/utils/fileLocks';
import { InternalActionsService } from '~/lib/services/internalActionsService';

// Extracted imports
import type { WorkspaceProps } from '~/types/jobConfig';
import {
  useAdhocRunClient,
  usePipelineConfigResponder,
  useProjectIdResponder,
  useHealthCheckResponder,
} from '~/lib/hooks/communicationBus';
import { viewTransition, sliderOptions, workbenchVariants } from './workbench.constants';
import type { FileHistory } from '~/types/actions';
import { PipelineBuildButton } from '~/components/chat/PipelineBuildButton';

const logger = createScopedLogger('Workbench');

export const Workbench = memo(
  ({
    chatStarted,
    isStreaming,
    metadata,
    updateChatMestaData,
    selectedTemplate,
    onSendMessage,
    onSetChatInput,
  }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    // Initialize sync and settings hooks
    const { forceSync, isInitialized: syncInitialized, syncStatus, currentProjectId } = useSync();
    const { syncEnabled } = useSettings();

    // Use extracted hooks
    const { isExecuting, executeAdhocRun } = useAdhocRunClient();

    // Handle pipeline config messages
    usePipelineConfigResponder({
      currentProjectId,
    });

    useProjectIdResponder({
      currentProjectId,
    });

    /*
     * Handle health check messages (HEARTBEAT and WAKE_UP)
     * This prevents iframe from freezing after idle periods
     */
    useHealthCheckResponder();

    // Log the current project ID for debugging
    useEffect(() => {
      if (currentProjectId) {
        logger.info('Workbench using project ID:', currentProjectId);
        debugProjectId('Workbench.client.tsx - useSync initialization');
      }
    }, [currentProjectId]);

    // const modifiedFiles = Array.from(useStore(workbenchStore.unsavedFiles).keys());

    // const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
    const hasPreview = false;
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const selectedFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const selectedView = useStore(workbenchStore.currentView);

    const { showChat } = useStore(chatStore);
    const isSmallViewport = useViewport(1024);

    /*
     * In panel mode (chatStarted && !isSmallViewport), we can always toggle chat
     * In fixed mode, we can only hide chat if workbench is shown or chat is already hidden
     */
    const isInPanel = chatStarted && !isSmallViewport;
    const canHideChat = isInPanel || showWorkbench || !showChat;

    const setSelectedView = (view: any) => {
      workbenchStore.currentView.set(view);
    };

    const handleExecuteAdhocRun = useCallback(
      async (isEditAndRun: boolean = false) => {
        await executeAdhocRun(isEditAndRun, selectedTemplate, currentProjectId);
      },
      [executeAdhocRun, selectedTemplate, currentProjectId],
    );

    /*
     * useEffect(() => {
     *   if (hasPreview) {
     *     setSelectedView('preview');
     *   }
     * }, [hasPreview]);
     */

    // Add an effect to set default view to code on init
    useEffect(() => {
      // Only set to code if no preview and not already set to something else
      if (!hasPreview) {
        setSelectedView('code');
      }
    }, []); // Empty dependency array to run once on mount

    useEffect(() => {
      workbenchStore.setDocuments(files);
    }, [files]);

    const onEditorChange = useCallback<OnEditorChange>((update) => {
      workbenchStore.setCurrentDocumentContent(update.content);
    }, []);

    const onEditorScroll = useCallback<OnEditorScroll>((position) => {
      workbenchStore.setCurrentDocumentScrollPosition(position);
    }, []);

    const onFileSelect = useCallback((filePath: string | undefined) => {
      workbenchStore.setSelectedFile(filePath);
    }, []);

    const onFileSave = useCallback(() => {
      workbenchStore
        .saveCurrentDocument()
        .then(() => {
          // Explicitly refresh all previews after a file save
          const previewStore = usePreviewStore();
          previewStore.refreshAllPreviews();
        })
        .catch(() => {
          toast.error('Failed to update file content');
        });
    }, []);

    const onFileReset = useCallback(() => {
      const currentDocument = workbenchStore.currentDocument.get();

      workbenchStore.resetCurrentDocument();

      // Clear the file history for the reset file to sync with diff state
      if (currentDocument?.filePath) {
        setFileHistory((prev) => {
          const newHistory = { ...prev };
          delete newHistory[currentDocument.filePath];

          return newHistory;
        });
      }
    }, []);

    const handleSyncFiles = useCallback(async () => {
      // Check if sync is enabled and initialized
      if (!syncEnabled) {
        toast.error('File sync is not enabled. Please enable it in Settings → Features');
        return;
      }

      if (!syncInitialized) {
        // Service not initialized - status indicator will show this
        return;
      }

      setIsSyncing(true);

      try {
        // Use the new Golang API sync instead of browser file system
        await forceSync();
        toast.success('Files synced successfully to Golang API and Minio storage');
      } catch (error) {
        logger.error('Error syncing files:', error);
        toast.error('Failed to sync files to Golang API');
      } finally {
        setIsSyncing(false);
      }
    }, [syncEnabled, syncInitialized, forceSync]);

    // Initialize InternalActionsService with workbench functions
    useEffect(() => {
      // Set the executeAdhocRun function for the internal actions service
      InternalActionsService.setExecuteAdhocRun(handleExecuteAdhocRun);

      // Set the sync function
      InternalActionsService.setSyncFiles(handleSyncFiles);

      // Set workbench store reference
      InternalActionsService.setWorkbenchStore(workbenchStore);

      // logger.info('InternalActionsService initialized with workbench functions');
    }, [handleExecuteAdhocRun, handleSyncFiles]);

    // Auto-execute workbench actions from AI messages
    const lastExecutedAtRef = useRef(0);
    const isExecutingRef = useRef(false);
    const executionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      const handleWorkbenchActionEvent = (event: CustomEvent) => {
        const { action, parameters, timestamp } = event.detail;
        logger.info('🎯 WORKBENCH: Received workbench-action event!', { action, parameters, timestamp });

        if (action === 'run' || action === 'edit-run') {
          const now = Date.now();
          const timeSinceLastRun = now - lastExecutedAtRef.current;
          const isEditAndRun = action === 'edit-run';

          // Enhanced debounce: Check both time-based and execution state
          if (timeSinceLastRun > 10000 && !isExecutingRef.current) {
            logger.info(`🚀 WORKBENCH: Auto-executing ${action} action from AI message!`);
            logger.debug('📁 WORKBENCH: Current files count:', Object.keys(files || {}).length);

            // Set execution state immediately to prevent concurrent executions
            lastExecutedAtRef.current = now;
            isExecutingRef.current = true;

            // Safety timeout to reset execution state after 30 seconds
            if (executionTimeoutRef.current) {
              clearTimeout(executionTimeoutRef.current);
            }

            executionTimeoutRef.current = setTimeout(() => {
              logger.warn('⚠️ WORKBENCH: Execution timeout - resetting execution state');
              isExecutingRef.current = false;
            }, 30000);

            try {
              // Show visual indicator in chat
              const runIndicator = document.createElement('div');
              runIndicator.className =
                'flex items-center gap-2 p-3 mb-2 rounded-lg bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border border-bolt-elements-borderColorActive';

              if (isEditAndRun) {
                runIndicator.innerHTML = `
                  <div class="i-ph:gear text-xl animate-pulse"></div>
                  <div class="flex-1">
                    <div class="font-medium">Opening Configuration</div>
                    <div class="text-sm opacity-90">Review and configure settings before running...</div>
                  </div>
                  <div class="i-ph:spinner animate-spin text-xl"></div>
                `;
              } else {
                runIndicator.innerHTML = `
                  <div class="i-ph:play-circle-fill text-xl animate-pulse"></div>
                  <div class="flex-1">
                    <div class="font-medium">Auto-Running Application</div>
                    <div class="text-sm opacity-90">Executing the generated code automatically...</div>
                  </div>
                  <div class="i-ph:spinner animate-spin text-xl"></div>
                `;
              }

              // Find the chat messages container and append the indicator
              const messagesContainer =
                document.querySelector('[class*="messages"]') ||
                document.querySelector('.flex.flex-col.gap-4') ||
                document.querySelector('[role="log"]');

              if (messagesContainer) {
                messagesContainer.appendChild(runIndicator);
                logger.debug(`📢 WORKBENCH: Added visual ${action} indicator to chat`);
              }

              // Delay to ensure files are fully written
              logger.debug('⏳ WORKBENCH: Waiting 3 seconds for files to be written...');
              setTimeout(async () => {
                logger.info(`⚡ WORKBENCH: Executing handleExecuteAdhocRun with isEditAndRun=${isEditAndRun}`);

                try {
                  await handleExecuteAdhocRun(isEditAndRun);
                  logger.info(`✅ WORKBENCH: Auto-${action} triggered successfully!`);

                  // Update the indicator to show completion
                  if (runIndicator && runIndicator.parentNode) {
                    if (isEditAndRun) {
                      runIndicator.innerHTML = `
                         <div class="i-ph:check-circle-fill text-xl text-green-500"></div>
                         <div class="flex-1">
                           <div class="font-medium">Configuration Dialog Opened</div>
                           <div class="text-sm opacity-90">Please review settings and click Run to execute</div>
                         </div>
                       `;
                    } else {
                      runIndicator.innerHTML = `
                         <div class="i-ph:check-circle-fill text-xl text-green-500"></div>
                         <div class="flex-1">
                           <div class="font-medium">Application Running</div>
                           <div class="text-sm opacity-90">Check the terminal below for output and logs</div>
                         </div>
                       `;
                    }

                    // Remove the indicator after a few seconds
                    setTimeout(() => {
                      if (runIndicator.parentNode) {
                        runIndicator.style.transition = 'opacity 0.5s';
                        runIndicator.style.opacity = '0';
                        setTimeout(() => runIndicator.remove(), 500);
                      }
                    }, 5000);
                  }
                } catch (error) {
                  logger.error(`❌ WORKBENCH: Auto-${action} failed:`, error);

                  // Update indicator to show error
                  if (runIndicator && runIndicator.parentNode) {
                    runIndicator.innerHTML = `
                       <div class="i-ph:x-circle-fill text-xl text-red-500"></div>
                       <div class="flex-1">
                         <div class="font-medium">Execution Failed</div>
                         <div class="text-sm opacity-90">Check the console for error details</div>
                       </div>
                     `;
                  }
                } finally {
                  // Reset execution state after completion or failure
                  isExecutingRef.current = false;

                  if (executionTimeoutRef.current) {
                    clearTimeout(executionTimeoutRef.current);
                    executionTimeoutRef.current = null;
                  }

                  logger.debug('🔓 WORKBENCH: Execution state reset, ready for next run');
                }
              }, 3000);
            } catch (error) {
              logger.error(`❌ WORKBENCH: Auto-${action} setup failed:`, error);
              isExecutingRef.current = false; // Reset on setup failure

              if (executionTimeoutRef.current) {
                clearTimeout(executionTimeoutRef.current);
                executionTimeoutRef.current = null;
              }
            }
          } else {
            const timeElapsedSeconds = Math.round(timeSinceLastRun / 1000);
            const executionStatus = isExecutingRef.current ? ' - another execution in progress' : '';
            logger.debug(
              `⏭️ WORKBENCH: Skipping duplicate execution (only ${timeElapsedSeconds}s since last run${executionStatus})`,
            );
          }
        } else if (action === 'sync') {
          logger.info('🔄 WORKBENCH: Sync action detected - would trigger sync');

          // Could add handleSyncFiles() here if needed
        } else if (action === 'build') {
          logger.info('🔨 WORKBENCH: Build action detected - would trigger build');

          // Could add build logic here if needed
        }
      };

      // Listen for the custom event from the message parser
      window.addEventListener('workbench-action-detected', handleWorkbenchActionEvent as EventListener);

      return () => {
        window.removeEventListener('workbench-action-detected', handleWorkbenchActionEvent as EventListener);

        // Cleanup timeout on component unmount
        if (executionTimeoutRef.current) {
          clearTimeout(executionTimeoutRef.current);
          executionTimeoutRef.current = null;
        }
      };
    }, [handleExecuteAdhocRun, files]);

    const handleDiffFileSelect = useCallback((filePath: string) => {
      workbenchStore.setSelectedFile(filePath);
      workbenchStore.currentView.set('diff');
    }, []);

    const workbenchContent = (
      <>
        <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor gap-1.5">
          <button
            className={`${showChat ? 'i-ph:sidebar-simple-fill' : 'i-ph:sidebar-simple'} text-lg text-bolt-elements-textSecondary mr-1`}
            disabled={!canHideChat || isSmallViewport}
            onClick={() => {
              if (canHideChat) {
                chatStore.setKey('showChat', !showChat);
              }
            }}
          />
          <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
          <div className="ml-auto" />
          {selectedView === 'code' && (
            <div className="flex overflow-y-auto">
              <div className="flex items-center gap-2 mr-1">
                <PipelineBuildButton className="mr-0" />
                <ButtonDropdown
                  onMainClick={() => handleExecuteAdhocRun(false)}
                  disabled={isExecuting || !currentProjectId}
                  variant="accent"
                  size="sm"
                  className="px-2 py-1 text-sm focus:ring-0 focus:ring-offset-0 !bg-bolt-elements-item-backgroundAccent hover:!bg-bolt-elements-item-backgroundAccent hover:opacity-90 !border-bolt-elements-borderColorActive shadow-sm"
                  dropdownTriggerClassName="px-2 !bg-bolt-elements-item-backgroundAccent hover:!bg-bolt-elements-item-backgroundAccent hover:opacity-90 !border-bolt-elements-borderColorActive"
                  options={[
                    {
                      label: 'Edit Config & Run',
                      value: 'edit-config',
                      icon: 'i-ph:gear text-bolt-elements-item-contentAccent',
                      onClick: () => handleExecuteAdhocRun(true),
                    },
                  ]}
                  align="end"
                  showArrow={true}
                >
                  {isExecuting ? (
                    <div className="i-ph:spinner animate-spin text-bolt-elements-item-contentAccent" />
                  ) : (
                    <div className="i-ph:play text-bolt-elements-item-contentAccent" />
                  )}
                </ButtonDropdown>
              </div>
              <div className="flex items-center gap-2">
                <PanelHeaderButton
                  className="mr-1 text-sm bg-bolt-elements-bg-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-bolt-elements-bg-depth-4 hover:text-bolt-elements-textPrimary shadow-sm"
                  onClick={handleSyncFiles}
                  disabled={isSyncing || !syncInitialized}
                >
                  {isSyncing ? (
                    <div className="i-ph:spinner animate-spin text-bolt-elements-item-contentAccent" />
                  ) : (
                    <div className="i-ph:cloud-arrow-up text-bolt-elements-item-contentAccent" />
                  )}
                  Sync
                </PanelHeaderButton>
                <StatusIndicator
                  status={
                    !syncInitialized
                      ? 'offline'
                      : !syncStatus.connected
                        ? 'warning'
                        : syncStatus.isRunning
                          ? 'loading'
                          : syncStatus.pendingChanges > 0
                            ? 'warning'
                            : 'success'
                  }
                  pulse={syncStatus.isRunning}
                  size="sm"
                />
              </div>
            </div>
          )}

          {selectedView === 'diff' && (
            <FileModifiedDropdown fileHistory={fileHistory} onSelectFile={handleDiffFileSelect} />
          )}
          <IconButton
            icon="i-ph:x-circle"
            className="-mr-1"
            size="xl"
            onClick={() => {
              workbenchStore.showWorkbench.set(false);
            }}
          />
        </div>
        <div className="relative flex-1 overflow-hidden">
          <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
            <EditorPanel
              editorDocument={currentDocument}
              isStreaming={isStreaming}
              selectedFile={selectedFile}
              files={files}
              unsavedFiles={unsavedFiles}
              fileHistory={fileHistory}
              onFileSelect={onFileSelect}
              onEditorScroll={onEditorScroll}
              onEditorChange={onEditorChange}
              onFileSave={onFileSave}
              onFileReset={onFileReset}
              onSendMessage={onSendMessage}
              onSetChatInput={onSetChatInput}
            />
          </View>
          <View
            initial={{ x: '100%' }}
            animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
          >
            <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />
          </View>
        </div>
      </>
    );

    // When in panel mode (chat started on desktop), render simple container
    if (isInPanel) {
      return (
        <>
          <div className="h-full w-full px-2 lg:px-4">
            <div className="h-full flex flex-col bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              {workbenchContent}
            </div>
          </div>
          <PushToGitHubDialog
            isOpen={isPushDialogOpen}
            onClose={() => setIsPushDialogOpen(false)}
            onPush={async (repoName, username, token, isPrivate) => {
              try {
                logger.info('Dialog onPush called with isPrivate =', isPrivate);

                const commitMessage = prompt('Please enter a commit message:', 'Initial commit') || 'Initial commit';
                const repoUrl = await workbenchStore.pushToGitHub(repoName, commitMessage, username, token, isPrivate);

                if (updateChatMestaData && !metadata?.gitUrl) {
                  updateChatMestaData({
                    ...(metadata || {}),
                    gitUrl: repoUrl,
                  });
                }

                return repoUrl;
              } catch (error) {
                logger.error('Error pushing to GitHub:', error);
                toast.error('Failed to push to GitHub');
                throw error;
              }
            }}
          />
        </>
      );
    }

    // Fixed positioning mode (when chat not started or on mobile)
    return (
      chatStarted && (
        <motion.div
          initial="closed"
          animate={showWorkbench ? 'open' : 'closed'}
          variants={workbenchVariants}
          className="z-workbench"
        >
          <div
            className={classNames(
              'fixed top-[calc(var(--header-height)+1.2rem)] bottom-6 w-[var(--workbench-inner-width)] z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
              {
                'w-full': isSmallViewport,
                'left-0': showWorkbench && isSmallViewport,
                'left-[var(--workbench-left)]': showWorkbench,
                'left-[100%]': !showWorkbench,
              },
            )}
          >
            <div className="absolute inset-0 px-2 lg:px-4">
              <div className="h-full flex flex-col bg-bolt-elements-bg-depth-1 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
                {workbenchContent}
              </div>
            </div>
          </div>
          <PushToGitHubDialog
            isOpen={isPushDialogOpen}
            onClose={() => setIsPushDialogOpen(false)}
            onPush={async (repoName, username, token, isPrivate) => {
              try {
                logger.info('Dialog onPush called with isPrivate =', isPrivate);

                const commitMessage = prompt('Please enter a commit message:', 'Initial commit') || 'Initial commit';
                const repoUrl = await workbenchStore.pushToGitHub(repoName, commitMessage, username, token, isPrivate);

                if (updateChatMestaData && !metadata?.gitUrl) {
                  updateChatMestaData({
                    ...(metadata || {}),
                    gitUrl: repoUrl,
                  });
                }

                return repoUrl;
              } catch (error) {
                logger.error('Error pushing to GitHub:', error);
                toast.error('Failed to push to GitHub');
                throw error;
              }
            }}
          />
        </motion.div>
      )
    );
  },
);

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
