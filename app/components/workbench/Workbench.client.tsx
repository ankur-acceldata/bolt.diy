import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';

// import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Popover, Transition } from '@headlessui/react';
import { diffLines, type Change } from 'diff';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import type { FileHistory } from '~/types/actions';
import { DiffView } from './DiffView';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { ButtonDropdown } from '~/components/ui/ButtonDropdown';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { StatusIndicator } from '~/components/ui/StatusIndicator';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import useViewport from '~/lib/hooks';
import { PushToGitHubDialog } from '~/components/@settings/tabs/connections/components/PushToGitHubDialog';
import { usePreviewStore } from '~/lib/stores/previews';
import { chatStore } from '~/lib/stores/chat';
import type { ElementInfo } from './Inspector';
import { useSync } from '~/lib/hooks/useSync';
import { useSettings } from '~/lib/hooks/useSettings';
import { apiFetch } from '~/utils/api';

const logger = createScopedLogger('Workbench');

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
  metadata?: {
    gitUrl?: string;
  };
  updateChatMestaData?: (metadata: any) => void;
  setSelectedElement?: (element: ElementInfo | null) => void;
  selectedTemplate?: {
    id: string;
    name: string;
  };
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
  model?: string;
  provider?: string;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'diff',
    text: 'Diff',
  },

  /*
   * right: {
   *   value: 'preview',
   *   text: 'Preview',
   * },
   */
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

const FileModifiedDropdown = memo(
  ({
    fileHistory,
    onSelectFile,
  }: {
    fileHistory: Record<string, FileHistory>;
    onSelectFile: (filePath: string) => void;
  }) => {
    const modifiedFiles = Object.entries(fileHistory);
    const hasChanges = modifiedFiles.length > 0;
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
      return modifiedFiles.filter(([filePath]) => filePath.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [modifiedFiles, searchQuery]);

    return (
      <div className="flex items-center gap-2">
        <Popover className="relative">
          {({ open }: { open: boolean }) => (
            <>
              <Popover.Button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-item-contentDefault">
                <span>File Changes</span>
                {hasChanges && (
                  <span className="w-5 h-5 rounded-full bg-accent-500/20 text-accent-500 text-xs flex items-center justify-center border border-accent-500/30">
                    {modifiedFiles.length}
                  </span>
                )}
              </Popover.Button>
              <Transition
                show={open}
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Popover.Panel className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl bg-bolt-elements-background-depth-2 shadow-xl border border-bolt-elements-borderColor">
                  <div className="p-2">
                    <div className="relative mx-2 mb-2">
                      <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary">
                        <div className="i-ph:magnifying-glass" />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {filteredFiles.length > 0 ? (
                        filteredFiles.map(([filePath, history]) => {
                          const extension = filePath.split('.').pop() || '';
                          const language = getLanguageFromExtension(extension);

                          return (
                            <button
                              key={filePath}
                              onClick={() => onSelectFile(filePath)}
                              className="w-full px-3 py-2 text-left rounded-md hover:bg-bolt-elements-background-depth-1 transition-colors group bg-transparent"
                            >
                              <div className="flex items-center gap-2">
                                <div className="shrink-0 w-5 h-5 text-bolt-elements-textTertiary">
                                  {['typescript', 'javascript', 'jsx', 'tsx'].includes(language) && (
                                    <div className="i-ph:file-js" />
                                  )}
                                  {['css', 'scss', 'less'].includes(language) && <div className="i-ph:paint-brush" />}
                                  {language === 'html' && <div className="i-ph:code" />}
                                  {language === 'json' && <div className="i-ph:brackets-curly" />}
                                  {language === 'python' && <div className="i-ph:file-text" />}
                                  {language === 'markdown' && <div className="i-ph:article" />}
                                  {['yaml', 'yml'].includes(language) && <div className="i-ph:file-text" />}
                                  {language === 'sql' && <div className="i-ph:database" />}
                                  {language === 'dockerfile' && <div className="i-ph:cube" />}
                                  {language === 'shell' && <div className="i-ph:terminal" />}
                                  {![
                                    'typescript',
                                    'javascript',
                                    'css',
                                    'html',
                                    'json',
                                    'python',
                                    'markdown',
                                    'yaml',
                                    'yml',
                                    'sql',
                                    'dockerfile',
                                    'shell',
                                    'jsx',
                                    'tsx',
                                    'scss',
                                    'less',
                                  ].includes(language) && <div className="i-ph:file-text" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate text-sm font-medium text-bolt-elements-textPrimary">
                                        {filePath.split('/').pop()}
                                      </span>
                                      <span className="truncate text-xs text-bolt-elements-textTertiary">
                                        {filePath}
                                      </span>
                                    </div>
                                    {(() => {
                                      // Calculate diff stats
                                      const { additions, deletions } = (() => {
                                        if (!history.originalContent) {
                                          return { additions: 0, deletions: 0 };
                                        }

                                        const normalizedOriginal = history.originalContent.replace(/\r\n/g, '\n');
                                        const normalizedCurrent =
                                          history.versions[history.versions.length - 1]?.content.replace(
                                            /\r\n/g,
                                            '\n',
                                          ) || '';

                                        if (normalizedOriginal === normalizedCurrent) {
                                          return { additions: 0, deletions: 0 };
                                        }

                                        const changes = diffLines(normalizedOriginal, normalizedCurrent, {
                                          newlineIsToken: false,
                                          ignoreWhitespace: true,
                                          ignoreCase: false,
                                        });

                                        return changes.reduce(
                                          (acc: { additions: number; deletions: number }, change: Change) => {
                                            if (change.added) {
                                              acc.additions += change.value.split('\n').length;
                                            }

                                            if (change.removed) {
                                              acc.deletions += change.value.split('\n').length;
                                            }

                                            return acc;
                                          },
                                          { additions: 0, deletions: 0 },
                                        );
                                      })();

                                      const showStats = additions > 0 || deletions > 0;

                                      return (
                                        showStats && (
                                          <div className="flex items-center gap-1 text-xs shrink-0">
                                            {additions > 0 && <span className="text-green-500">+{additions}</span>}
                                            {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
                                          </div>
                                        )
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center justify-center p-4 text-center">
                          <div className="w-12 h-12 mb-2 text-bolt-elements-textTertiary">
                            <div className="i-ph:file-dashed" />
                          </div>
                          <p className="text-sm font-medium text-bolt-elements-textPrimary">
                            {searchQuery ? 'No matching files' : 'No modified files'}
                          </p>
                          <p className="text-xs text-bolt-elements-textTertiary mt-1">
                            {searchQuery ? 'Try another search' : 'Changes will appear here as you edit'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {hasChanges && (
                    <div className="border-t border-bolt-elements-borderColor p-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(filteredFiles.map(([filePath]) => filePath).join('\n'));
                          toast('File list copied to clipboard', {
                            icon: <div className="i-ph:check-circle text-accent-500" />,
                          });
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
                      >
                        Copy File List
                      </button>
                    </div>
                  )}
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    );
  },
);

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
    // Handle Edit Configuration callback
    const handleEditConfiguration = () => {
      console.log('Edit Configuration clicked');
    };
    renderLogger.trace('Workbench');

    const [isSyncing, setIsSyncing] = useState(false);
    const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);
    const [fileHistory, setFileHistory] = useState<Record<string, FileHistory>>({});
    const [isExecuting, setIsExecuting] = useState(false);

    // Initialize sync and settings hooks
    const { forceSync, isInitialized: syncInitialized, syncStatus, currentProjectId } = useSync();
    const { syncEnabled } = useSettings();

    // Log the current project ID for debugging
    useEffect(() => {
      if (currentProjectId) {
        console.log('Workbench using project ID:', currentProjectId);
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

    const setSelectedView = (view: WorkbenchViewType) => {
      workbenchStore.currentView.set(view);
    };

    // Helper function to extract shell commands from bolt actions
    const extractShellCommands = useCallback(() => {
      const artifacts = workbenchStore.artifacts.get();
      const shellCommands: string[] = [];

      Object.values(artifacts).forEach((artifact) => {
        const actions = artifact.runner.actions.get();
        Object.values(actions).forEach((action) => {
          if (action.type === 'shell' && action.content) {
            // Split multiline commands and filter out empty lines
            const commands = action.content
              .split('\n')
              .map((cmd) => cmd.trim())
              .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'));

            logger.info('Extracted shell commands:', commands);

            shellCommands.push(...commands);
          }
        });
      });

      return shellCommands;
    }, []);

    // Helper function to get execution configuration based on template
    const getExecutionConfig = useCallback(
      (template?: { id: string; name: string }) => {
        const extractedCommands = extractShellCommands();

        // Get template-specific defaults
        const getTemplateDefaults = (templateId?: string) => {
          switch (templateId) {
            case 'java-application':
              return {
                adhocRunType: 'SPARK_JAVA_ADHOC_RUN',
                type: 'Java',
                fallbackStages: [
                  'mvn clean compile',
                  'mvn exec:java -Dexec.mainClass="Main"',
                  "echo 'Java execution completed successfully'",
                ],
                codeSourceUrl: 'home/projects',
              };
            case 'python-application':
            default:
              return {
                adhocRunType: 'SPARK_PYTHON_ADHOC_RUN',
                type: 'Python',
                fallbackStages: [
                  'pip install -r requirements.txt --no-cache-dir',
                  'python3 success_test.py',
                  "echo 'Python execution completed successfully'",
                ],
                codeSourceUrl: 'home/projects',
              };
          }
        };

        const defaults = getTemplateDefaults(template?.id);

        // Use extracted commands if available, otherwise fall back to template defaults
        const stages = extractedCommands.length > 0 ? extractedCommands : defaults.fallbackStages;

        return {
          adhocRunType: defaults.adhocRunType,
          type: defaults.type,
          stages,
          codeSourceUrl: defaults.codeSourceUrl,
        };
      },
      [extractShellCommands],
    );

    const handleExecuteAdhocRun = useCallback(async () => {
      /*
       * Check if sync is enabled and initialized - this is mandatory
       * if (!syncEnabled) {
       *   toast.error('File sync is required for adhoc runs. Please enable sync in Settings → Features');
       *   return;
       * }
       */

      /*
       * if (!syncInitialized) {
       *   toast.error('Sync is still initializing. Please wait for sync to complete before running adhoc jobs.');
       *   return;
       * }
       */

      if (!currentProjectId) {
        toast.error('Project ID not available. Please wait for sync initialization to complete.');
        return;
      }

      // Use the project ID from sync - no fallback since sync is mandatory
      const projectId = currentProjectId;

      setIsExecuting(true);

      try {
        // Get execution configuration based on selected template
        const execConfig = getExecutionConfig(selectedTemplate);

        console.log('Adhoc Run Execution Config:', {
          selectedTemplate,
          projectId,
          syncInitialized,
          extractedCommands: extractShellCommands(),
          finalConfig: execConfig,
        });

        const payload = {
          config: {
            adhocRunType: execConfig.adhocRunType,
            image: 'docker.io/apache/spark:4.0.0', // TODO: Discuss on how to take user input for base image
            codeSource: {
              type: 'MINIO',
              config: {
                // Use project ID in the code source URL for project-specific storage
                url: `${execConfig.codeSourceUrl}/${projectId}`,
              },
            },
            stages: execConfig.stages,
            type: execConfig.type,
            mode: 'cluster', // MODE can be cluster
          },
          dataplaneName: 'bhuvan-tanaya-pipeline-dp', // TODO: fetch this post event bus integration
        };

        const response = await apiFetch('/api/adhoc-run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as {
          error?: string;
          message?: string;
          data?: any;
          success?: boolean;
        };

        if (!response.ok) {
          throw new Error(result.error || `Execution failed: ${response.status}`);
        }

        toast.success(result.message || 'Adhoc run executed successfully!');

        /*
         * Extract information for log streaming
         * Expected format from example: wss://demo.xdp.acceldata.tech/xdp-cp-service/api/dataplane/135/logs/adhoc-run-spar-1753369519227/stream?tailLines=100
         */
        if (result.success && result.data) {
          // Extract pod name and dataplane ID from the API response
          const podName =
            result.data?.data?.podName || result.data?.name || result.data?.id || `adhoc-run-spar-${Date.now()}`;
          const dataplaneId =
            result.data?.data?.dataplaneId || result.data?.dataplane?.id || result.data?.dataplane || '135';

          console.log('Extracted from adhoc-run response:', { podName, dataplaneId, responseData: result.data });

          // Open log viewer with extracted parameters
          workbenchStore.toggleLogViewer(true, { dataplaneId: String(dataplaneId), podName: String(podName) });
        }
      } catch (error) {
        console.error('Execute adhoc run error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to execute adhoc run');
      } finally {
        setIsExecuting(false);
      }
    }, [selectedTemplate, getExecutionConfig, syncEnabled, syncInitialized, currentProjectId]);

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
        console.error('Error syncing files:', error);
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
              <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
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
                          onMainClick={handleExecuteAdhocRun}
                          disabled={isExecuting || !currentProjectId}
                          variant="accent"
                          size="sm"
                          className="px-1.5 py-0.5 text-sm focus:ring-0 focus:ring-offset-0"
                          dropdownTriggerClassName="px-1"
                          options={[
                            {
                              label: 'Edit Config',
                              value: 'edit-config',
                              icon: 'i-ph:gear',
                              onClick: handleEditConfiguration,
                            },
                          ]}
                          align="end"
                          showArrow={true}
                        >
                          {isExecuting ? (
                            <div className="i-ph:spinner animate-spin" />
                          ) : (
                            <div className="i-ph:play text-bolt-elements-button-primary-text" />
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
                          className="mr-1 text-sm"
                          onClick={handleSyncFiles}
                          disabled={isSyncing || !syncInitialized}
                        >
                          {isSyncing ? (
                            <div className="i-ph:spinner animate-spin" />
                          ) : (
                            <div className="i-ph:cloud-arrow-up" />
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
                console.log('Dialog onPush called with isPrivate =', isPrivate);

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
                console.error('Error pushing to GitHub:', error);
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
