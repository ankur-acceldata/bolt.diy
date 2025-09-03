import { memo, useMemo, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { createScopedLogger } from '~/utils/logger';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap } from '~/lib/stores/files';
import type { EditorDocument } from '~/components/editor/codemirror/CodeMirrorEditor';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import type { FileHistory } from '~/types/actions';
import FileTree from './FileTree';
import { InlineDiffComparison } from './DiffView';
import { WORK_DIR } from '~/utils/constants';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useSnapshotFileDiff } from '~/lib/hooks/useSnapshotFileDiff';

const logger = createScopedLogger('DiffPanel');

interface DiffPanelProps {
  fileHistory: Record<string, FileHistory>;
  setFileHistory: React.Dispatch<React.SetStateAction<Record<string, FileHistory>>>;
}

/**
 * Creates a filtered file map containing only files with changes and their parent folders
 * ensuring proper folder hierarchy for FileTree rendering
 */
const createFilteredFileMap = (files: FileMap, fileHistory: Record<string, FileHistory>): FileMap => {
  const modifiedFilePaths = Object.keys(fileHistory);

  if (modifiedFilePaths.length === 0) {
    return {};
  }

  // Create a new map for our filtered files
  const filteredFiles: FileMap = {};

  // Create root folder entry if not hiding root
  filteredFiles[WORK_DIR] = { type: 'folder' };

  // Process each modified file
  modifiedFilePaths.forEach((filePath) => {
    // Skip if this file doesn't exist in the original files map
    if (!files[filePath]) {
      return;
    }

    // Add the file itself if it's a file (not a folder)
    if (files[filePath] && files[filePath].type === 'file') {
      filteredFiles[filePath] = files[filePath];
    }

    // Build parent folders tree
    const segments = filePath.split('/');
    let currentPath = '';

    // Add each folder in the path
    for (let i = 1; i < segments.length; i++) {
      currentPath += '/' + segments[i - 1];

      // Skip if this is the work directory itself
      if (currentPath === WORK_DIR) {
        continue;
      }

      // If folder doesn't exist in our filtered map, add it
      if (!filteredFiles[currentPath]) {
        // Check if it exists in original files map
        const folderEntry = files[currentPath];

        if (folderEntry && folderEntry.type === 'folder') {
          filteredFiles[currentPath] = folderEntry;
        } else {
          // Create a synthetic folder entry
          filteredFiles[currentPath] = { type: 'folder' };
        }
      }
    }
  });

  return filteredFiles;
};

/**
 * Component that displays a file tree of modified files and their diffs
 */
export const DiffPanel = memo(({ fileHistory }: DiffPanelProps) => {
  // Get necessary state from workbench store
  const files = useStore(workbenchStore.files) as FileMap;
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument) as EditorDocument;
  const currentView = useStore(workbenchStore.currentView); // Get current tab view

  // Use snapshot diff for complete comparison
  const { fileChanges } = useSnapshotFileDiff();

  // Create combined file history that includes both legacy fileHistory and snapshot changes
  const combinedFileHistory = useMemo(() => {
    const combined: Record<string, FileHistory> = { ...fileHistory };

    // Add snapshot changes to the combined history
    Object.entries(fileChanges).forEach(([filePath, snapshotDiff]) => {
      if (!combined[filePath] && snapshotDiff.hasChanges) {
        // Create a pseudo FileHistory entry for snapshot-only changes
        combined[filePath] = {
          originalContent: snapshotDiff.originalContent || '',
          lastModified: Date.now(),
          changes: [],
          versions: [
            {
              timestamp: Date.now(),
              content: snapshotDiff.currentContent || '',
            },
          ],
          changeSource: 'snapshot',
        };
      }
    });

    return combined;
  }, [fileHistory, fileChanges]);

  // Create filtered file map with all changed files (both legacy and snapshot)
  const filteredFiles = useMemo(() => {
    return createFilteredFileMap(files, combinedFileHistory);
  }, [files, combinedFileHistory]);

  // Handle file selection from the file tree
  const handleFileSelect = useCallback((filePath: string) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  // Auto-select first file if none is selected - only when in diff tab
  useEffect(() => {
    if (
      currentView === 'diff' && // Only run auto-selection when in diff view
      (!selectedFile ||
        (!combinedFileHistory[selectedFile] &&
          Object.keys(combinedFileHistory).length > 0 &&
          Object.keys(filteredFiles).length > 0))
    ) {
      // Find the first valid file entry (not folder)
      const firstModifiedFile = Object.keys(combinedFileHistory).find((path) => {
        return files[path] && files[path].type === 'file';
      });

      if (firstModifiedFile) {
        workbenchStore.setSelectedFile(firstModifiedFile);
      }
    }
  }, [selectedFile, combinedFileHistory, files, filteredFiles, currentView]);

  // If there are no modified files
  if (Object.keys(combinedFileHistory).length === 0) {
    return (
      <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
        <div className="text-center">
          <div className="i-ph:file-check text-4xl mb-2 text-bolt-elements-textTertiary" />
          <p>No file changes detected</p>
          <p className="text-sm mt-2 text-bolt-elements-textTertiary">Make changes to files to see diffs</p>
        </div>
      </div>
    );
  }

  // If no file is selected or document is not available
  if (!selectedFile || !currentDocument || !combinedFileHistory[selectedFile]) {
    return (
      <div className="h-full w-full flex overflow-hidden">
        {/* Left Panel - Modified Files Tree */}
        <div
          className="h-full border-r border-bolt-elements-borderColor"
          style={{ width: '25%', minWidth: '200px', maxWidth: '300px' }}
        >
          <div className="h-full flex flex-col">
            <div className="text-sm font-medium p-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
              <div className="flex items-center gap-1.5">
                <div className="i-ph:git-diff text-bolt-elements-textSecondary" />
                <span className="text-bolt-elements-textPrimary">
                  Modified Files ({Object.keys(fileHistory).length})
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree
                files={filteredFiles}
                hideRoot={false}
                rootFolder={WORK_DIR}
                selectedFile={selectedFile}
                fileHistory={fileHistory}
                onFileSelect={handleFileSelect}
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Empty Selection State */}
        <div className="flex flex-1 h-full justify-center items-center bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary">
          <div className="text-center">
            <div className="i-ph:selection-plus text-4xl mb-2 text-bolt-elements-textTertiary" />
            <p>Select a file to view differences</p>
            <p className="text-sm mt-2 text-bolt-elements-textTertiary">Choose from the modified files on the left</p>
          </div>
        </div>
      </div>
    );
  }

  // Get content for comparison
  const file = files[selectedFile];
  const originalContent = file && file.type === 'file' ? file.content : '';
  const currentContent = currentDocument.value;

  // Get history for the selected file
  const history = combinedFileHistory[selectedFile];
  const effectiveOriginalContent = history?.originalContent || originalContent;

  // Get language for syntax highlighting
  const language = getLanguageFromExtension(selectedFile.split('.').pop() || '');

  try {
    return (
      <div className="h-full w-full flex overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left Panel - Modified Files Tree */}
          <Panel defaultSize={20} minSize={15} collapsible className="border-r border-bolt-elements-borderColor">
            <div className="h-full flex flex-col">
              <div className="text-sm font-medium p-2 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
                <div className="flex items-center gap-1.5">
                  <div className="i-ph:git-diff text-bolt-elements-textSecondary" />
                  <span className="text-bolt-elements-textPrimary">
                    Modified Files ({Object.keys(combinedFileHistory).length})
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <FileTree
                  files={filteredFiles}
                  hideRoot={false}
                  rootFolder={WORK_DIR}
                  selectedFile={selectedFile}
                  fileHistory={combinedFileHistory}
                  onFileSelect={handleFileSelect}
                  className="h-full"
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle />

          {/* Right Panel - Diff View */}
          <Panel className="h-full flex-1 overflow-hidden">
            <InlineDiffComparison
              beforeCode={effectiveOriginalContent}
              afterCode={currentContent}
              language={language}
              filename={selectedFile}
              lightTheme="github-light"
              darkTheme="github-dark"
            />
          </Panel>
        </PanelGroup>
      </div>
    );
  } catch (error) {
    logger.error('DiffPanel render error:', error);
    return (
      <div className="flex w-full h-full justify-center items-center bg-bolt-elements-background-depth-1 text-red-400">
        <div className="text-center">
          <div className="i-ph:warning-circle text-4xl mb-2" />
          <p>Failed to render diff view</p>
        </div>
      </div>
    );
  }
});
