import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/components/ui/Dialog';

// Add useStore import for the menu store
import { useStore } from '@nanostores/react';
import { menuStore } from '~/lib/stores/menu';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { ControlPanel } from '~/components/@settings/core/ControlPanel';

import { Button } from '~/components/ui/Button';
import { Checkbox } from '~/components/ui/Checkbox';
import {
  db,
  deleteById,
  getAll,
  getMessages,
  setMessages,
  chatId,
  type ChatHistoryItem,
  useChatHistory,
} from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { navigateToHome, getBasePath } from '~/utils/api';
import { useSearchFilter } from '~/lib/hooks/useSearchFilter';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Menu');

/*
 * import { useStore } from '@nanostores/react';
 * import { profileStore } from '~/lib/stores/profile';
 */

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent =
  | { type: 'delete'; item: ChatHistoryItem; deletePipelines?: boolean }
  | { type: 'bulkDelete'; items: ChatHistoryItem[]; deletePipelines?: boolean }
  | null;

/*
 * function CurrentDateTime() {
 * const [dateTime, setDateTime] = useState(new Date());
 *
 * useEffect(() => {
 *  const timer = setInterval(() => {
 *    setDateTime(new Date());
 *  }, 60000);
 *
 *  return () => clearInterval(timer);
 * }, []);
 *
 * return (
 *  <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800/50">
 *    <div className="h-4 w-4 i-ph:clock opacity-80" />
 *    <div className="flex gap-2">
 *      <span>{dateTime.toLocaleDateString()}</span>
 *      <span>{dateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
 *    </div>
 *  </div>
 * );
 * }
 */

export const Menu = () => {
  const { duplicateCurrentChat, exportChat } = useChatHistory();
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);

  // Replace local state with the store
  const open = useStore(menuStore);

  // Remove: const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // const profile = useStore(profileStore);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchInputValue, setSearchInputValue] = useState('');

  const { filteredItems: filteredList, handleSearchChange } = useSearchFilter({
    items: list,
    searchFields: ['description'],
  });

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearchInputValue(value);
      handleSearchChange(event);
    },
    [handleSearchChange],
  );

  const handleClearSearch = useCallback(() => {
    setSearchInputValue('');
    handleSearchChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
  }, [handleSearchChange]);

  const loadEntries = useCallback(async () => {
    try {
      // Fetch projects from backend API
      logger.info('📡 Fetching all projects from backend...');

      const response = await fetch('/api/projects', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const result = (await response.json()) as { success: boolean; data?: any };

      logger.info('📦 Backend response:', {
        success: result.success,
        hasData: !!result.data,
        dataType: typeof result.data,
        dataKeys: result.data ? Object.keys(result.data) : [],
      });

      /*
       * Extract projects array from nested structure
       * Backend returns: { success, data: { data: { projects: [...] } } }
       */
      const projectsArray = result.data?.data?.projects || result.data?.projects || result.data;

      logger.info('📦 Projects array:', {
        isArray: Array.isArray(projectsArray),
        length: Array.isArray(projectsArray) ? projectsArray.length : 0,
      });

      if (result.success && projectsArray && Array.isArray(projectsArray)) {
        logger.info(`✅ Loaded ${projectsArray.length} projects from backend`);

        // Log first project to see structure
        if (projectsArray.length > 0) {
          logger.info('📋 Sample project structure:', projectsArray[0]);
        }

        // Transform backend projects to ChatHistoryItem format
        const transformedList: ChatHistoryItem[] = projectsArray
          .map((project: any) => {
            const transformed = {
              id: String(project.id),
              urlId: String(project.id),
              description: project.name || project.description || 'Untitled Project',
              messages: [],
              timestamp: project.updatedAt || project.createdAt || new Date().toISOString(),
            };

            logger.debug('🔄 Transformed project:', { original: project.id, transformed });

            return transformed;
          })
          .filter((item: ChatHistoryItem) => {
            const isValid = item.urlId && item.description;

            if (!isValid) {
              logger.warn('⚠️ Filtered out invalid item:', item);
            }

            return isValid;
          });

        logger.info(`📊 Transformed ${transformedList.length} projects for display`);
        setList(transformedList);

        // Also store in IndexedDB for offline access
        if (db) {
          logger.info('💾 Caching projects in IndexedDB...');

          for (const project of projectsArray) {
            try {
              // Check if project exists in IndexedDB
              const existingChat = await getMessages(db, String(project.id));

              if (!existingChat) {
                // Only create entry if it doesn't exist
                await setMessages(
                  db,
                  String(project.id),
                  [], // Empty messages for now
                  String(project.id), // urlId
                  project.name || project.description || 'Untitled Project',
                  project.updatedAt || project.createdAt,
                  undefined, // metadata
                );
              }
            } catch (error) {
              logger.warn(`Failed to cache project ${project.id} in IndexedDB:`, error);
            }
          }

          logger.info('✅ Projects cached in IndexedDB');
        }
      } else {
        logger.warn('No projects returned from backend');
        setList([]);
      }
    } catch (error: any) {
      logger.error('Failed to load projects from backend:', error);
      toast.error('Failed to load projects from backend');

      // Fallback to IndexedDB if backend fails
      if (db) {
        logger.info('⚠️ Falling back to IndexedDB...');
        getAll(db)
          .then((list) => list.filter((item) => item.urlId && item.description))
          .then(setList)
          .catch((fallbackError) => {
            logger.error('IndexedDB fallback also failed:', fallbackError);
            toast.error(fallbackError.message);
          });
      }
    }
  }, [db]);

  const deleteChat = useCallback(
    async (id: string, deletePipelines: boolean = false): Promise<void> => {
      if (!db) {
        throw new Error('Database not available');
      }

      // Delete from backend API first
      try {
        logger.info(`Deleting project ${id} from backend (deletePipelines: ${deletePipelines})`);

        const response = await fetch(`/api/projects/${id}?deletePipelines=${deletePipelines}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          logger.warn(`Backend delete failed for project ${id}: ${response.status}`);

          // Continue with local deletion even if backend fails
        } else {
          logger.info(`Successfully deleted project ${id} from backend`);
        }
      } catch (backendError) {
        logger.error(`Error deleting project ${id} from backend:`, backendError);

        // Continue with local deletion even if backend fails
      }

      // Delete chat snapshot from localStorage
      try {
        const snapshotKey = `snapshot:${id}`;
        localStorage.removeItem(snapshotKey);
        logger.debug('Removed snapshot for chat:', id);
      } catch (snapshotError) {
        logger.error(`Error deleting snapshot for chat ${id}:`, snapshotError);
      }

      // Delete the chat from the local database
      await deleteById(db, id);
      logger.info('fully deleted chat:', id);
    },
    [db],
  );

  const deleteItem = useCallback(
    (event: React.UIEvent, item: ChatHistoryItem, deletePipelines: boolean = false) => {
      event.preventDefault();
      event.stopPropagation();

      // Log the delete operation to help debugging
      logger.debug('Attempting to delete chat:', {
        id: item.id,
        description: item.description,
        deletePipelines,
      });

      deleteChat(item.id, deletePipelines)
        .then(async () => {
          toast.success(`Chat deleted successfully${deletePipelines ? ' (including pipelines)' : ''}`, {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Always refresh the list
          loadEntries();

          if (chatId.get() === item.id) {
            // Clear URL state to prevent restoration to deleted project
            try {
              const { clearURLState } = await import('~/utils/urlStateManager');
              clearURLState();
              logger.debug('Cleared URL state for deleted project');
            } catch (error) {
              logger.error('Failed to clear URL state:', error);
            }

            // hard page navigation to clear the stores
            logger.debug('Navigating away from deleted chat');
            navigateToHome(true);
          }
        })
        .catch((error) => {
          logger.error('Failed to delete chat:', error);
          toast.error('Failed to delete conversation', {
            position: 'bottom-right',
            autoClose: 3000,
          });

          // Still try to reload entries in case data has changed
          loadEntries();
        });
    },
    [loadEntries, deleteChat],
  );

  const deleteSelectedItems = useCallback(
    async (itemsToDeleteIds: string[]) => {
      if (!db || itemsToDeleteIds.length === 0) {
        logger.debug('Bulk delete skipped: No DB or no items to delete.');
        return;
      }

      logger.debug(`Starting bulk delete for ${itemsToDeleteIds.length} chats`, itemsToDeleteIds);

      let deletedCount = 0;
      const errors: string[] = [];
      const currentChatId = chatId.get();
      let shouldNavigate = false;

      // Process deletions sequentially using the shared deleteChat logic
      for (const id of itemsToDeleteIds) {
        try {
          await deleteChat(id);
          deletedCount++;

          if (id === currentChatId) {
            shouldNavigate = true;
          }
        } catch (error) {
          logger.error(`Error deleting chat ${id}:`, error);
          errors.push(id);
        }
      }

      // Show appropriate toast message
      if (errors.length === 0) {
        toast.success(`${deletedCount} chat${deletedCount === 1 ? '' : 's'} deleted successfully`);
      } else {
        toast.warning(`Deleted ${deletedCount} of ${itemsToDeleteIds.length} chats. ${errors.length} failed.`, {
          autoClose: 5000,
        });
      }

      // Reload the list after all deletions
      await loadEntries();

      // Clear selection state
      setSelectedItems([]);
      setSelectionMode(false);

      // Navigate if needed
      if (shouldNavigate) {
        // Clear URL state to prevent restoration to deleted project
        try {
          const { clearURLState } = await import('~/utils/urlStateManager');
          clearURLState();
          logger.debug('Cleared URL state for deleted project(s)');
        } catch (error) {
          logger.error('Failed to clear URL state:', error);
        }

        logger.debug('Navigating away from deleted chat');
        navigateToHome(true);
      }
    },
    [deleteChat, loadEntries, db],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  /*
   * Selection mode toggle - currently disabled in UI
   * const toggleSelectionMode = () => {
   *   setSelectionMode(!selectionMode);
   *
   *   if (selectionMode) {
   *     // If turning selection mode OFF, clear selection
   *     setSelectedItems([]);
   *   }
   * };
   */

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      logger.debug('Selected items updated:', newSelectedItems);

      return newSelectedItems; // Return the new array
    });
  }, []); // No dependencies needed

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('Select at least one chat to delete');
      return;
    }

    const selectedChats = list.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('Could not find selected chats');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, list]); // Keep list dependency

  const selectAll = useCallback(() => {
    const allFilteredIds = filteredList.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        logger.debug('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      } else {
        // Select all filtered items, adding them to any existing selections
        const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
        logger.debug('Selecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
    });
  }, [filteredList]); // Depends only on filteredList

  // Load projects on mount (initial load)
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Refresh projects when menu opens (for updates)
  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open, loadEntries]);

  // Add keyboard shortcut for settings
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+, or Ctrl+, to open settings
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setSettingsOpen(true);
      }

      // Escape to close settings
      if (event.key === 'Escape' && settingsOpen) {
        setSettingsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen]);

  // Exit selection mode when sidebar is closed
  useEffect(() => {
    if (!open && selectionMode) {
      /*
       * Don't clear selection state anymore when sidebar closes
       * This allows the selection to persist when reopening the sidebar
       */
      logger.debug('Sidebar closed, preserving selection state');
    }
  }, [open, selectionMode]);

  // Comment out mouse movement control - now controlled by header button click
  /*
   * useEffect(() => {
   *   const enterThreshold = 20;
   *   const exitThreshold = 20;
   *
   *   function onMouseMove(event: MouseEvent) {
   *     if (isSettingsOpen) {
   *       return;
   *     }
   *
   *     if (event.pageX < enterThreshold) {
   *       setOpen(true);
   *     }
   *
   *     if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
   *       setOpen(false);
   *     }
   *   }
   *
   *   window.addEventListener('mousemove', onMouseMove);
   *
   *   return () => {
   *     window.removeEventListener('mousemove', onMouseMove);
   *   };
   * }, [isSettingsOpen]);
   */

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadEntries(); // Reload the list after duplication
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    logger.debug('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  return (
    <>
      <ControlPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <motion.div
        ref={menuRef}
        initial="open"
        animate={open ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '340px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu fixed top-0 h-full rounded-r-2xl',
          'bg-bolt-elements-bg-depth-2 border-r-2 border-bolt-elements-borderColor',
          '[background:var(--bolt-elements-bg-depth-2,#f9fafb)]', // Fallback background
          'shadow-lg text-sm backdrop-blur-md',
          'z-sidebar',
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 border-b border-bolt-elements-borderColor bg-bolt-elements-bg-depth-3 rounded-tr-2xl">
          <div className="text-bolt-elements-textPrimary font-medium"></div>
          <div className="flex items-center gap-3">
            {/* <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {profile?.username || 'Guest User'}
            </span> */}
            {/* <div className="flex items-center justify-center w-[32px] h-[32px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0">
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={profile?.username || 'User'}
                  className="w-full h-full object-cover"
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <div className="i-ph:user-fill text-lg" />
              )}
            </div> */}
          </div>
        </div>
        {/* <CurrentDateTime /> */}
        <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <a
                href={getBasePath()}
                onClick={() => {
                  // Set a flag to indicate intentional navigation to home
                  sessionStorage.setItem('bolt_navigation_intent', 'new_chat');
                }}
                className="flex-1 flex gap-2 items-center bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent font-medium hover:bg-bolt-elements-item-backgroundAccent hover:opacity-90 rounded-lg px-4 py-2 transition-colors"
              >
                <span className="inline-block i-ph:plus-circle h-4 w-4" />
                <span className="text-sm font-medium">Start new chat</span>
              </a>
              {/* <button
                onClick={toggleSelectionMode}
                className={classNames(
                  'flex gap-1 items-center rounded-lg px-3 py-2 transition-colors min-w-[44px] justify-center',
                  selectionMode
                    ? 'bg-bolt-elements-item-contentAccent text-white border border-bolt-elements-borderColorActive shadow-md'
                    : 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor shadow-md hover:shadow-lg',
                )}
                aria-label={selectionMode ? 'Exit selection mode' : 'Enter selection mode'}
              >
                <span className={selectionMode ? 'i-ph:x h-4 w-4' : 'i-ph:check-square h-4 w-4'} />
              </button> */}
            </div>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <span className="i-ph:magnifying-glass h-4 w-4 text-bolt-elements-textSecondary" />
              </div>
              <input
                className="w-full bg-bolt-elements-bg-depth-2 relative pl-9 pr-10 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-bolt-elements-borderColorActive text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textSecondary border border-bolt-elements-borderColor [background:var(--bolt-elements-bg-depth-2)] [color:var(--bolt-elements-textPrimary)] [&::-webkit-search-cancel-button]:hidden"
                type="search"
                placeholder="Search chats..."
                onChange={handleInputChange}
                aria-label="Search chats"
                value={searchInputValue}
              />
              {searchInputValue && searchInputValue.trim().length > 0 && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundActive transition-colors w-5 h-5 flex items-center justify-center text-xs leading-none rounded-md border border-bolt-elements-borderColor/30"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between text-sm px-4 py-2">
            <div className="font-medium text-bolt-elements-textSecondary">Your Chats</div>
            {selectionMode && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedItems.length === filteredList.length ? 'Deselect all' : 'Select all'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  disabled={selectedItems.length === 0}
                >
                  Delete selected
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto px-3 pb-3">
            {filteredList.length === 0 && (
              <div className="px-4 text-bolt-elements-textTertiary text-sm">
                {list.length === 0 ? 'No previous conversations' : 'No matches found'}
              </div>
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(filteredList).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-bg-depth-2 px-4 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        exportChat={exportChat}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          logger.debug('Delete triggered for item:', item);
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectionMode}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-bg-depth-1">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Chat?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete{' '}
                          <span className="font-medium text-bolt-elements-textPrimary">
                            {dialogContent.item.description}
                          </span>
                        </p>
                        <p className="mt-2">Are you sure you want to delete this chat?</p>
                        <div className="mt-4 flex items-start gap-3 p-3 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor">
                          <Checkbox
                            checked={dialogContent.deletePipelines || false}
                            onCheckedChange={(checked) => {
                              setDialogContentWithLogging({
                                ...dialogContent,
                                deletePipelines: checked === true,
                              });
                            }}
                          />
                          <div className="flex-1">
                            <label className="text-sm font-medium text-bolt-elements-textPrimary cursor-pointer">
                              Also delete related code and pipeline
                            </label>
                            <p className="text-xs text-bolt-elements-textTertiary mt-1">
                              This will permanently remove all associated files and pipeline configurations
                            </p>
                          </div>
                        </div>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          logger.debug('Dialog delete button clicked for item:', dialogContent.item);
                          deleteItem(event, dialogContent.item, dialogContent.deletePipelines || false);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-bolt-elements-bg-depth-1">
                      <DialogTitle className="text-bolt-elements-textPrimary">Delete Selected Chats?</DialogTitle>
                      <DialogDescription className="mt-2 text-bolt-elements-textSecondary">
                        <p>
                          You are about to delete {dialogContent.items.length}{' '}
                          {dialogContent.items.length === 1 ? 'chat' : 'chats'}:
                        </p>
                        <div className="mt-2 max-h-32 overflow-auto border border-bolt-elements-borderColor rounded-md bg-bolt-elements-bg-depth-2 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-bolt-elements-textPrimary">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="mt-3">Are you sure you want to delete these chats?</p>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-bolt-elements-bg-depth-2 border-t border-bolt-elements-borderColor">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        Cancel
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          logger.debug('Bulk delete confirmed for', itemsToDeleteNow.length, 'items', itemsToDeleteNow);
                          deleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        Delete
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          <div className="flex items-center justify-between border-t border-bolt-elements-borderColor px-4 py-3">
            {/* <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-colors"
              title="Settings (Cmd+,)"
            >
              <span className="i-ph:gear h-4 w-4" />
              <span>Settings</span>
            </button> */}
            <ThemeSwitch />
          </div>
        </div>
      </motion.div>
    </>
  );
};
