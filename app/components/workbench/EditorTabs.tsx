import { memo, useCallback } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { classNames } from '~/utils/classNames';
import { workbenchStore } from '~/lib/stores/workbench';
import { path } from '~/utils/path';

interface EditorTabsProps {
  openTabs: string[];
  selectedFile: string | undefined;
  unsavedFiles: Set<string>;
  onFileSelect: (filePath: string) => void;
}

export const EditorTabs = memo(({ openTabs, selectedFile, unsavedFiles, onFileSelect }: EditorTabsProps) => {
  const handleCloseTab = useCallback((e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    workbenchStore.closeTab(filePath);
  }, []);

  const handleCloseOtherTabs = useCallback((filePath: string) => {
    workbenchStore.closeOtherTabs(filePath);
  }, []);

  const handleCloseAllTabs = useCallback(() => {
    workbenchStore.closeAllTabs();
  }, []);

  if (openTabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto overflow-y-hidden bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor scrollbar-thin scrollbar-thumb-bolt-elements-borderColor scrollbar-track-transparent hover:scrollbar-thumb-bolt-elements-textTertiary">
      {openTabs.map((filePath) => {
        const isSelected = selectedFile === filePath;
        const isUnsaved = unsavedFiles.has(filePath);
        const fileName = path.basename(filePath);

        return (
          <ContextMenu.Root key={filePath}>
            <ContextMenu.Trigger asChild>
              <button
                onClick={() => onFileSelect(filePath)}
                className={classNames(
                  'group relative flex items-center gap-1.5 px-3 py-2 text-sm transition-all duration-150 flex-shrink-0 min-w-[120px] max-w-[200px] border-r border-bolt-elements-borderColor',
                  {
                    'bg-bolt-elements-background-depth-1 text-bolt-elements-textPrimary shadow-sm': isSelected,
                    'bg-transparent text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 hover:text-bolt-elements-textPrimary':
                      !isSelected,
                  },
                )}
                title={filePath}
              >
                {/* File icon */}
                <span
                  className={classNames('i-ph:file-duotone shrink-0 text-base', {
                    'text-bolt-elements-textPrimary': isSelected,
                    'text-bolt-elements-textTertiary group-hover:text-bolt-elements-textSecondary': !isSelected,
                  })}
                />

                {/* File name */}
                <span className="truncate flex-1 text-left font-medium">{fileName}</span>

                {/* Unsaved indicator or close button */}
                <div className="flex items-center shrink-0">
                  {isUnsaved && (
                    <span
                      className={classNames('i-ph:circle-fill text-[8px] mr-1', {
                        'text-bolt-elements-item-contentAccent': isSelected,
                        'text-orange-500': !isSelected,
                      })}
                    />
                  )}
                  <span
                    onClick={(e) => handleCloseTab(e, filePath)}
                    className={classNames(
                      'i-ph:x text-base p-0.5 rounded transition-all duration-150',
                      'hover:bg-bolt-elements-background-depth-4',
                      {
                        'opacity-100 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary': isSelected,
                        'opacity-0 group-hover:opacity-100 text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
                          !isSelected,
                      },
                    )}
                  />
                </div>

                {/* Active tab indicator */}
                {isSelected && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-bolt-elements-item-contentAccent" />
                )}
              </button>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content
                style={{ zIndex: 999 }}
                className="min-w-[220px] border border-bolt-elements-borderColor rounded-lg shadow-lg z-context-menu bg-bolt-elements-background-depth-1 p-1 data-[state=open]:animate-in animate-duration-100 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              >
                <ContextMenu.Item
                  onSelect={() => handleCloseTab({ stopPropagation: () => {} } as React.MouseEvent, filePath)}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                >
                  <span className="i-ph:x text-base text-bolt-elements-textSecondary" />
                  <span>Close</span>
                  <span className="ml-auto text-xs text-bolt-elements-textTertiary">Ctrl+W</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                  onSelect={() => handleCloseOtherTabs(filePath)}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                >
                  <span className="i-ph:x-circle text-base text-bolt-elements-textSecondary" />
                  <span>Close Others</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                  onSelect={() => {
                    const currentIndex = openTabs.indexOf(filePath);
                    const tabsToRight = openTabs.slice(currentIndex + 1);
                    tabsToRight.forEach((tab) => workbenchStore.closeTab(tab));
                  }}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                  disabled={openTabs.indexOf(filePath) === openTabs.length - 1}
                >
                  <span className="i-ph:arrow-right text-base text-bolt-elements-textSecondary" />
                  <span>Close Tabs to the Right</span>
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-bolt-elements-borderColor" />
                <ContextMenu.Item
                  onSelect={handleCloseAllTabs}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                >
                  <span className="i-ph:x-square text-base text-bolt-elements-textSecondary" />
                  <span>Close All</span>
                </ContextMenu.Item>
                <ContextMenu.Separator className="my-1 h-px bg-bolt-elements-borderColor" />
                <ContextMenu.Item
                  onSelect={() => navigator.clipboard.writeText(filePath)}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                >
                  <span className="i-ph:copy text-base text-bolt-elements-textSecondary" />
                  <span>Copy Path</span>
                </ContextMenu.Item>
                <ContextMenu.Item
                  onSelect={() => {
                    const relativePath = filePath.replace(/^\/[^/]+\//, '');
                    navigator.clipboard.writeText(relativePath);
                  }}
                  className="flex items-center gap-3 px-3 py-2 outline-none text-sm text-bolt-elements-textPrimary cursor-pointer rounded-md hover:bg-bolt-elements-item-backgroundActive transition-colors"
                >
                  <span className="i-ph:copy-simple text-base text-bolt-elements-textSecondary" />
                  <span>Copy Relative Path</span>
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        );
      })}
    </div>
  );
});

EditorTabs.displayName = 'EditorTabs';
