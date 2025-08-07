import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';
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

// Extracted imports
import type { WorkspaceProps } from '~/types/jobConfig';
import { useAdhocRun } from '~/lib/hooks/useAdhocRun';
import { usePipelineConfigHandler } from '~/lib/hooks/usePipelineConfigHandler';
import { viewTransition, sliderOptions, workbenchVariants } from './workbench.constants';
import type { FileHistory } from '~/types/actions';

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
    model,
    provider,
  }: WorkspaceProps) => {
    renderLogger.trace('Workbench');

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});

    // Initialize sync and settings hooks
    const { forceSync, isInitialized: syncInitialized, syncStatus, currentProjectId } = useSync();
    const { syncEnabled } = useSettings();

    // Use extracted hooks
    const { isExecuting, executeAdhocRun, extractShellCommands, getJobConfigFromXdp } = useAdhocRun();

    // Handle pipeline config messages
    usePipelineConfigHandler({
      extractShellCommands,
      getJobConfigFromXdp,
      currentProjectId,
    });

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
    const canHideChat = showWorkbench || !showChat;

    const isSmallViewport = useViewport(1024);

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

    const handleDiffFileSelect = useCallback((filePath: string) => {
      workbenchStore.setSelectedFile(filePath);
      workbenchStore.currentView.set('diff');
    }, []);

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
                      <div className="flex items-center mr-1">
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
                      {/* <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                      }}
                    >
                      <div className="i-ph:terminal" />
                      Toggle Terminal
                    </PanelHeaderButton> */}
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
                      model={model}
                      provider={provider}
                    />
                  </View>
                  <View
                    initial={{ x: '100%' }}
                    animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
                  >
                    <DiffView fileHistory={fileHistory} setFileHistory={setFileHistory} />
                  </View>
                  {/* <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
                    <Preview setSelectedElement={setSelectedElement} />
                  </View> */}
                </div>
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
