import { memo, useState, useMemo } from 'react';
import { Popover, Transition } from '@headlessui/react';
import { diffLines, type Change } from 'diff';
import { toast } from 'react-toastify';
import { getLanguageFromExtension } from '~/utils/getLanguageFromExtension';
import type { FileHistory } from '~/types/actions';

interface FileModifiedDropdownProps {
  fileHistory: Record<string, FileHistory>;
  onSelectFile: (filePath: string) => void;
}

export const FileModifiedDropdown = memo(({ fileHistory, onSelectFile }: FileModifiedDropdownProps) => {
  const modifiedFiles = Object.entries(fileHistory);
  const hasChanges = modifiedFiles.length > 0;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFiles = useMemo(() => {
    return modifiedFiles.filter(([filePath]) => filePath.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [modifiedFiles, searchQuery]);

  const calculateDiffStats = (history: FileHistory) => {
    if (!history.originalContent) {
      return { additions: 0, deletions: 0 };
    }

    const normalizedOriginal = history.originalContent.replace(/\r\n/g, '\n');
    const normalizedCurrent = history.versions[history.versions.length - 1]?.content.replace(/\r\n/g, '\n') || '';

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
  };

  const getFileIcon = (language: string) => {
    if (['typescript', 'javascript', 'jsx', 'tsx'].includes(language)) {
      return <div className="i-ph:file-js" />;
    }

    if (['css', 'scss', 'less'].includes(language)) {
      return <div className="i-ph:paint-brush" />;
    }

    if (language === 'html') {
      return <div className="i-ph:code" />;
    }

    if (language === 'json') {
      return <div className="i-ph:brackets-curly" />;
    }

    if (language === 'python') {
      return <div className="i-ph:file-text" />;
    }

    if (language === 'markdown') {
      return <div className="i-ph:article" />;
    }

    if (['yaml', 'yml'].includes(language)) {
      return <div className="i-ph:file-text" />;
    }

    if (language === 'sql') {
      return <div className="i-ph:database" />;
    }

    if (language === 'dockerfile') {
      return <div className="i-ph:cube" />;
    }

    if (language === 'shell') {
      return <div className="i-ph:terminal" />;
    }

    return <div className="i-ph:file-text" />;
  };

  const handleCopyFileList = () => {
    navigator.clipboard.writeText(filteredFiles.map(([filePath]) => filePath).join('\n'));
    toast('File list copied to clipboard', {
      icon: <div className="i-ph:check-circle text-bolt-elements-item-contentAccent" />,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Popover className="relative">
        {({ open }: { open: boolean }) => (
          <>
            <Popover.Button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-colors text-bolt-elements-item-contentDefault">
              <span>File Changes</span>
              {hasChanges && (
                <span className="w-5 h-5 rounded-full bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent text-xs flex items-center justify-center border border-bolt-elements-borderColorActive/30">
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
                        const { additions, deletions } = calculateDiffStats(history);
                        const showStats = additions > 0 || deletions > 0;

                        return (
                          <button
                            key={filePath}
                            onClick={() => onSelectFile(filePath)}
                            className="w-full px-3 py-2 text-left rounded-md hover:bg-bolt-elements-background-depth-1 transition-colors group bg-transparent"
                          >
                            <div className="flex items-center gap-2">
                              <div className="shrink-0 w-5 h-5 text-bolt-elements-textTertiary">
                                {getFileIcon(language)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate text-sm font-medium text-bolt-elements-textPrimary">
                                      {filePath.split('/').pop()}
                                    </span>
                                    <span className="truncate text-xs text-bolt-elements-textTertiary">{filePath}</span>
                                  </div>
                                  {showStats && (
                                    <div className="flex items-center gap-1 text-xs shrink-0">
                                      {additions > 0 && <span className="text-green-500">+{additions}</span>}
                                      {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
                                    </div>
                                  )}
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
                      onClick={handleCopyFileList}
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
});

FileModifiedDropdown.displayName = 'FileModifiedDropdown';
