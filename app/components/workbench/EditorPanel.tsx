import { useStore } from '@nanostores/react';
import { memo, useMemo, useRef, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Tabs from '@radix-ui/react-tabs';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE } from './terminal/TerminalTabs';
import { LogViewerTabs } from './LogViewerTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { Search } from './Search';
import { classNames } from '~/utils/classNames';
import { LockManager } from './LockManager';
import { EditorTabs } from './EditorTabs';
import { TextSelectionContextMenu } from '~/components/ui/TextSelectionContextMenu';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
    onSendMessage,
    onSetChatInput,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const themeConfig = useStore(themeStore);
    const theme = themeConfig.mode;
    const showTerminal = useStore(workbenchStore.showTerminal);
    const logViewerInstances = useStore(workbenchStore.logViewerInstances);
    const showLogViewerPanel = useStore(workbenchStore.showLogViewerPanel);
    const openTabs = useStore(workbenchStore.openTabs);

    // Track user interactions to prevent auto-switching during streaming
    const userInteractingRef = useRef(false);
    const lastUserInteractionRef = useRef(0);

    // Mark user interaction when they manually select a file
    const handleFileSelect = (filePath: string) => {
      userInteractingRef.current = true;
      lastUserInteractionRef.current = Date.now();
      onFileSelect?.(filePath);

      // Reset interaction flag after a delay
      setTimeout(() => {
        userInteractingRef.current = false;
      }, 1000);
    };

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      // Make sure unsavedFiles is a Set before calling has()
      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    // Handler for text selection in editor
    const handleSendEditorSelectionToChat = useCallback(
      (selectedText: string) => {
        if (!selectedText.trim() || !onSetChatInput) {
          return;
        }

        const fileName = editorDocument?.filePath ? editorDocument.filePath.split('/').pop() : 'file';
        const message = `Please analyze this code from \`${fileName}\`:\n\n\`\`\`\n${selectedText}\n\`\`\`\n\nAnalyze what this code does, identify any issues or potential improvements, and fix them if required. Provide a clear explanation and any necessary code changes.`;

        onSetChatInput(message);
      },
      [onSetChatInput, editorDocument],
    );

    return (
      <div className="relative h-full">
        <PanelGroup direction="vertical">
          <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
            <PanelGroup direction="horizontal">
              <Panel defaultSize={20} minSize={15} collapsible className="border-r border-bolt-elements-borderColor">
                <div className="h-full">
                  <Tabs.Root defaultValue="files" className="flex flex-col h-full">
                    <PanelHeader className="w-full text-sm font-medium text-bolt-elements-textSecondary px-1">
                      <div className="h-full flex-shrink-0 flex items-center justify-between w-full">
                        <Tabs.List className="h-full flex-shrink-0 flex items-center">
                          <Tabs.Trigger
                            value="files"
                            className={classNames(
                              'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                            )}
                          >
                            Files
                          </Tabs.Trigger>
                          <Tabs.Trigger
                            value="search"
                            className={classNames(
                              'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                            )}
                          >
                            Search
                          </Tabs.Trigger>
                          <Tabs.Trigger
                            value="locks"
                            className={classNames(
                              'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                            )}
                          >
                            Locks
                          </Tabs.Trigger>
                        </Tabs.List>
                      </div>
                    </PanelHeader>

                    <Tabs.Content value="files" className="flex-grow overflow-auto focus-visible:outline-none">
                      <FileTree
                        className="h-full"
                        files={files}
                        hideRoot
                        unsavedFiles={unsavedFiles}
                        fileHistory={fileHistory}
                        rootFolder={WORK_DIR}
                        selectedFile={selectedFile}
                        onFileSelect={handleFileSelect}
                      />
                    </Tabs.Content>

                    <Tabs.Content value="search" className="flex-grow overflow-auto focus-visible:outline-none">
                      <Search />
                    </Tabs.Content>

                    <Tabs.Content value="locks" className="flex-grow overflow-auto focus-visible:outline-none">
                      <LockManager />
                    </Tabs.Content>
                  </Tabs.Root>
                </div>
              </Panel>

              <PanelResizeHandle />
              <Panel className="flex flex-col" defaultSize={80} minSize={20}>
                {/* Editor Tabs */}
                <EditorTabs
                  openTabs={openTabs}
                  selectedFile={selectedFile}
                  unsavedFiles={unsavedFiles || new Set()}
                  onFileSelect={handleFileSelect}
                />
                <PanelHeader className="overflow-x-auto">
                  {activeFileSegments?.length && (
                    <div className="flex items-center flex-1 text-sm">
                      <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={handleFileSelect} />
                      {activeFileUnsaved && (
                        <div className="flex gap-1 ml-auto -mr-1.5">
                          <PanelHeaderButton onClick={onFileSave}>
                            <div className="i-ph:floppy-disk-duotone" />
                            Save
                          </PanelHeaderButton>
                          <PanelHeaderButton onClick={onFileReset}>
                            <div className="i-ph:clock-counter-clockwise-duotone" />
                            Reset
                          </PanelHeaderButton>
                        </div>
                      )}
                    </div>
                  )}
                </PanelHeader>
                <div className="h-full flex-1 overflow-hidden modern-scrollbar">
                  <TextSelectionContextMenu onSendToChat={handleSendEditorSelectionToChat} enabled={!!onSetChatInput}>
                    <CodeMirrorEditor
                      theme={theme}
                      editable={!isStreaming && editorDocument !== undefined}
                      settings={editorSettings}
                      doc={editorDocument}
                      autoFocusOnDocumentChange={!isMobile()}
                      onScroll={onEditorScroll}
                      onChange={onEditorChange}
                      onSave={onFileSave}
                    />
                  </TextSelectionContextMenu>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
          {logViewerInstances.length > 0 && (
            <>
              <PanelResizeHandle />
              <LogViewerTabs onSendMessage={onSendMessage} onSetChatInput={onSetChatInput} />
            </>
          )}
        </PanelGroup>
        {/* Maximize button - absolute at bottom of workbench when minimized */}
        {logViewerInstances.length > 0 && !showLogViewerPanel && (
          <div className="absolute bottom-0 left-0 right-0 z-50 flex items-center justify-center bg-bolt-elements-background-depth-2 border-t border-bolt-elements-borderColor py-2 px-4 shadow-lg">
            <button
              onClick={() => workbenchStore.toggleLogViewerPanel(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary bg-bolt-elements-background-depth-1 hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              title="Click to expand log viewers"
            >
              <div className="i-ph:terminal-window-duotone text-lg text-bolt-elements-item-contentAccent" />
              <span className="font-medium">
                {logViewerInstances.length} Log Viewer{logViewerInstances.length > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-bolt-elements-textTertiary">(Click to expand)</span>
              <div className="i-ph:caret-up text-base ml-1" />
            </button>
          </div>
        )}
      </div>
    );
  },
);
