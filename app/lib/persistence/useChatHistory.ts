import { useLoaderData, useSearchParams } from '@remix-run/react';
import { useState, useEffect, useCallback } from 'react';
import { atom } from 'nanostores';
import { generateId, type JSONValue, type Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { logStore } from '~/lib/stores/logs'; // Import logStore
import { createChatUrl, navigateToChat, navigateToHome } from '~/utils/api';
import { streamingState } from '~/lib/stores/streaming';
import {
  getMessages,
  createProjectAndGetId,
  openDatabase,
  setMessages,
  duplicateChat,
  createChatFromMessages,
  setSnapshot,
  getLatestVersionedSnapshot,
  getAll,
  type IChatMetadata,
} from './db';
import type { FileMap } from '~/lib/stores/files';
import type { Snapshot, ChangeType } from './types';
import { createInitialSnapshot, hasExistingSnapshots, triggerSnapshot } from './snapshotUtils';
import { webcontainer } from '~/lib/webcontainer';
import { detectProjectCommands, createCommandActionsString } from '~/utils/projectCommands';
import type { ContextAnnotation } from '~/types/context';
import { resolveActualChatId } from '~/utils/fileLocks';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useChatHistory');

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: IChatMetadata;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);
export const chatMetadata = atom<IChatMetadata | undefined>(undefined);
export function useChatHistory() {
  const { id: mixedId } = useLoaderData<{ id?: string }>();
  const [searchParams] = useSearchParams();

  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  useEffect(() => {
    if (!db) {
      setReady(true);

      if (persistenceEnabled) {
        const error = new Error('Chat persistence is unavailable');
        logStore.logError('Chat persistence initialization failed', error);
        toast.error('Chat persistence is unavailable');
      }

      return;
    }

    if (mixedId) {
      // Debug: Check all chats in database before trying to load specific one
      getAll(db)
        .then((allChats: ChatHistoryItem[]) => {
          logger.info(`📊 Database contents before loading ${mixedId}:`);
          allChats.forEach((chat: ChatHistoryItem, index: number) => {
            logger.info(
              `  [${index}] Chat:`,
              JSON.stringify(
                {
                  id: chat.id,
                  urlId: chat.urlId,
                  description: chat.description,
                  messageCount: chat.messages?.length || 0,
                  matchesRequestedId: chat.id === mixedId || chat.urlId === mixedId,
                },
                null,
                2,
              ),
            );
          });

          if (allChats.length === 0) {
            logger.info(`📊 Database is empty - no chats found`);
          }
        })
        .catch((err: any) => logger.error('Failed to get all chats for debugging:', err));

      // Debug each lookup method separately
      Promise.all([
        getMessages(db, mixedId).then((result) => {
          logger.info(`🔍 getMessages(${mixedId}) result:`, result);
          return result;
        }),
        getLatestVersionedSnapshot(db, mixedId),
      ])
        .then(async ([storedMessages, snapshot]) => {
          logger.info(`🔍 Chat loading result for ${mixedId}:`, {
            foundMessages: !!storedMessages,
            messageCount: storedMessages?.messages?.length || 0,
            chatId: storedMessages?.id,
            urlId: storedMessages?.urlId,
            description: storedMessages?.description,
            hasMessages: storedMessages?.messages && storedMessages.messages.length > 0,
            storedMessagesType: typeof storedMessages,
            storedMessagesKeys: storedMessages ? Object.keys(storedMessages) : 'null',
            storedMessagesValue: storedMessages,
            isFalsy: !storedMessages,
            isNull: storedMessages === null,
            isUndefined: storedMessages === undefined,
          });

          if (!storedMessages) {
            logger.error(`❌ CHAT NOT FOUND for ${mixedId} - redirecting to home`);
            logger.error(`❌ storedMessages value:`, storedMessages);
            logger.error(`❌ typeof storedMessages:`, typeof storedMessages);
            navigateToHome(true);
            setReady(true);
            setIsInitialLoad(false);

            return;
          }

          if (storedMessages) {
            // Chat found - load it regardless of message count
            if (storedMessages.messages && storedMessages.messages.length > 0) {
              // Chat with messages - process normally
              const validSnapshot = snapshot;
              const summary = validSnapshot?.summary;

              const rewindId = searchParams.get('rewindTo');
              let startingIdx = -1;
              const endingIdx = rewindId
                ? storedMessages.messages.findIndex((m) => m.id === rewindId) + 1
                : storedMessages.messages.length;
              const snapshotIndex = storedMessages.messages.findIndex((m) => m.id === validSnapshot?.chatIndex);

              if (snapshotIndex >= 0 && snapshotIndex < endingIdx) {
                startingIdx = snapshotIndex;
              }

              if (snapshotIndex > 0 && storedMessages.messages[snapshotIndex].id == rewindId) {
                startingIdx = -1;
              }

              let filteredMessages = storedMessages.messages.slice(startingIdx + 1, endingIdx);
              let archivedMessages: Message[] = [];

              if (startingIdx >= 0) {
                archivedMessages = storedMessages.messages.slice(0, startingIdx + 1);
              }

              setArchivedMessages(archivedMessages);
              console.log('DEBUG: startingIdx', startingIdx);

              if (startingIdx > 0) {
                const files = Object.entries(validSnapshot?.files || {})
                  .map(([key, value]) => {
                    if (value?.type !== 'file') {
                      return null;
                    }

                    return {
                      content: value.content,
                      path: key,
                    };
                  })
                  .filter((x): x is { content: string; path: string } => !!x); // Type assertion
                console.log('DEBUG: validSnapshot', validSnapshot);
                console.log('DEBUG: files', files);

                const projectCommands = await detectProjectCommands(files);

                // Call the modified function to get only the command actions string
                const commandActionsString = createCommandActionsString(projectCommands);

                filteredMessages = [
                  {
                    id: generateId(),
                    role: 'user',
                    content: `Restore project from snapshot`, // Removed newline
                    annotations: ['no-store', 'hidden'],
                  },
                  {
                    id: storedMessages.messages[snapshotIndex].id,
                    role: 'assistant',

                    // Combine followup message and the artifact with files and command actions
                    content: `Bolt Restored your chat from a snapshot. You can revert this message to load the full chat history.
                    <boltArtifact id="restored-project-setup" title="Restored Project & Setup" type="bundled">
                    ${Object.entries(snapshot?.files || {})
                      .map(([key, value]) => {
                        if (value?.type === 'file') {
                          return `
                        <boltAction type="file" filePath="${key}">
${value.content}
                        </boltAction>
                        `;
                        } else {
                          return ``;
                        }
                      })
                      .join('\n')}
                    ${commandActionsString}
                    </boltArtifact>
                    `, // Added commandActionsString, followupMessage, updated id and title
                    annotations: [
                      'no-store',
                      ...(summary
                        ? [
                            {
                              chatId: storedMessages.messages[snapshotIndex].id,
                              type: 'chatSummary',
                              summary,
                            } satisfies ContextAnnotation,
                          ]
                        : []),
                    ],
                  },

                  // Remove the separate user and assistant messages for commands
                  /*
                   *...(commands !== null // This block is no longer needed
                   *  ? [ ... ]
                   *  : []),
                   */
                  ...filteredMessages,
                ];
                restoreSnapshot(mixedId);
              }

              setInitialMessages(filteredMessages);
            } else {
              // Chat found but empty (newly created) - load it without messages
              logger.info(`📭 Loading empty chat: ${mixedId}`);
              setInitialMessages([]);
              setArchivedMessages([]);
            }

            // Set chat metadata for both cases (with/without messages)
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);
            chatMetadata.set(storedMessages.metadata);

            // Sync backend project with IndexedDB data on navigation/reload
            syncBackendProjectWithIndexedDB(storedMessages.id, storedMessages.description);
          }

          setReady(true);
          setIsInitialLoad(false);
        })
        .catch((error) => {
          logger.error(`❌ ERROR loading chat ${mixedId}:`, error);
          console.error(error);

          logStore.logError('Failed to load chat messages or snapshot', error);
          toast.error('Failed to load chat: ' + error.message);

          // Set ready state even on error to prevent infinite loading
          setReady(true);
          setIsInitialLoad(false);
        });
    } else {
      /*
       * Handle case where there is no mixedId (e.g., new chat)
       * Don't create backend project immediately - wait for user to send first message
       */
      setReady(true);
      setIsInitialLoad(false);
    }
  }, [mixedId, db, searchParams]); // Added db, searchParams dependencies

  const createNewChatProject = async () => {
    try {
      // Check if we already have a chatId to prevent duplicate creation
      const existingChatId = chatId.get();

      if (existingChatId) {
        logger.info('Chat project already exists:', existingChatId);
        setUrlId(existingChatId);

        return;
      }

      // Use any existing description or default
      const currentDescription = description.get();
      const projectData = {
        name: currentDescription || 'New Chat Project',
        description: currentDescription || 'AI Chat Project',
      };

      logger.info('Creating new backend project...');

      const backendProjectId = await createProjectAndGetId(projectData);

      // Set the chat ID to the backend project ID immediately
      chatId.set(backendProjectId);
      setUrlId(backendProjectId);

      // Store empty chat in IndexedDB immediately so it can be loaded later
      if (db) {
        try {
          await setMessages(
            db,
            backendProjectId,
            [], // Empty messages array
            backendProjectId, // urlId same as id in unified system
            currentDescription || 'New Chat',
            undefined,
            { gitUrl: '', projectId: backendProjectId }, // Basic metadata
          );
          logger.info('✅ Stored empty chat in IndexedDB:', backendProjectId);
        } catch (error) {
          logger.error('❌ Failed to store empty chat in IndexedDB:', error);
        }
      }

      // Update URL with backend projectId
      window.history.replaceState({}, '', createChatUrl(backendProjectId));

      logger.info('Created new chat with backend projectId:', backendProjectId);
    } catch (error) {
      logger.error('Failed to create backend project for new chat:', error);
      throw error;
    }
  };

  const syncBackendProjectWithIndexedDB = async (projectId: string, indexedDBDescription?: string) => {
    try {
      if (!projectId || projectId === 'default') {
        logger.info('Skipping backend sync - no valid project ID');
        return;
      }

      logger.info(`🔄 Syncing backend project ${projectId} with IndexedDB data...`);

      const { ProjectService: projectService } = await import('~/lib/services/projectService');

      // Step 1: Get current backend project state
      const backendProject = await projectService.getProject(projectId);
      logger.info('📋 Backend project state:', backendProject);

      // Step 2: Check what data is missing in backend
      const missingName = !backendProject.name || backendProject.name === '';
      const missingDescription = !backendProject.description || backendProject.description === '';
      const missingUrl = !backendProject.url || backendProject.url === '';

      logger.info('🔍 Backend missing data check:', {
        missingName,
        missingDescription,
        missingUrl,
      });

      // Step 3: If missing data, update backend with IndexedDB data
      if (missingName || missingDescription || missingUrl) {
        const updateData: any = {};

        if ((missingName || missingDescription) && indexedDBDescription) {
          updateData.name = indexedDBDescription;
          updateData.description = indexedDBDescription;
        }

        if (missingUrl) {
          updateData.url = `home/projects/${projectId}`;
        }

        if (Object.keys(updateData).length > 0) {
          logger.info('🔄 Updating backend with IndexedDB data:', updateData);
          await projectService.updateProject(projectId, updateData);
          logger.info('✅ Backend project synced successfully');
        }
      } else {
        logger.info('✅ Backend project already complete - no sync needed');
      }
    } catch (error) {
      logger.error('❌ Failed to sync backend project:', error);

      // Don't throw - keep chat loading even if sync fails
    }
  };

  const updateProjectNameIfNeeded = async (newTitle: string) => {
    try {
      const currentChatId = chatId.get();

      if (!currentChatId) {
        return;
      }

      // Update backend project with AI-generated title
      logger.info('Updating backend project with AI-generated title:', newTitle, 'for project:', currentChatId);

      try {
        const { ProjectService: projectService } = await import('~/lib/services/projectService');
        await projectService.updateProject(currentChatId, {
          name: newTitle,
          description: newTitle, // Use the same title for both name and description as requested
        });
        logger.info('Successfully updated project with new title:', newTitle);
      } catch (updateError) {
        logger.error('Failed to update backend project:', updateError);

        // Don't throw here to avoid breaking chat functionality if project update fails
      }
    } catch (error) {
      logger.error('Failed to update project name:', error);
    }
  };

  const takeSnapshot = useCallback(
    async (
      chatIdx: string,
      files: FileMap,
      _chatId?: string | undefined,
      chatSummary?: string,
      changeType?: ChangeType,
    ) => {
      const currentChatId = chatId.get();

      if (!currentChatId || !db) {
        return;
      }

      try {
        // Resolve the mixed chatId to the actual chatId to prevent duplicate snapshots
        const actualChatId = await resolveActualChatId(currentChatId);
        let finalChangeType: ChangeType = changeType || 'user-edit';

        // Check if this is an initial snapshot (no previous snapshots)
        const latestSnapshot = await getLatestVersionedSnapshot(db, actualChatId);

        if (!latestSnapshot) {
          finalChangeType = 'initial';
        }

        // Store the versioned snapshot
        await triggerSnapshot(db, actualChatId, files, finalChangeType, chatIdx);

        console.log(`Created ${finalChangeType} snapshot for chat ${actualChatId}`);
      } catch (error) {
        console.error('Failed to save versioned snapshot:', error);

        // Fallback to the old snapshot system
        const legacySnapshot: Snapshot = {
          chatIndex: chatIdx,
          files,
          summary: chatSummary,
        };

        try {
          await setSnapshot(db, currentChatId, legacySnapshot);
          console.log('Fallback to legacy snapshot system successful');
        } catch (fallbackError) {
          console.error('Failed to save fallback snapshot:', fallbackError);
          toast.error('Failed to save chat snapshot.');
        }
      }
    },
    [db],
  );

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    // const snapshotStr = localStorage.getItem(`snapshot:${id}`); // Remove localStorage usage
    const container = await webcontainer;

    const validSnapshot = snapshot || { chatIndex: '', files: {} };

    if (!validSnapshot?.files) {
      return;
    }

    console.log('DEBUG: validSnapshot', validSnapshot);

    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (key.startsWith(container.workdir)) {
        key = key.replace(container.workdir, '');
      }

      if (value?.type === 'folder') {
        await container.fs.mkdir(key, { recursive: true });
      }
    });
    Object.entries(validSnapshot.files).forEach(async ([key, value]) => {
      if (value?.type === 'file') {
        if (key.startsWith(container.workdir)) {
          key = key.replace(container.workdir, '');
        }

        await container.fs.writeFile(key, value.content, { encoding: value.isBinary ? undefined : 'utf8' });
      } else {
      }
    });

    // workbenchStore.files.setKey(snapshot?.files)
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    createNewChatProject,
    updateChatMestaData: async (metadata: IChatMetadata) => {
      const id = chatId.get();

      if (!db || !id) {
        return;
      }

      try {
        // Resolve the actual chatId before saving
        const actualChatId = await resolveActualChatId(id);
        await setMessages(db, actualChatId, initialMessages, urlId, description.get(), undefined, metadata);
        chatMetadata.set(metadata);
      } catch (error) {
        toast.error('Failed to update chat metadata');
        console.error(error);
      }
    },
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;
      messages = messages.filter((m) => !m.annotations?.includes('no-store'));

      const _urlId = urlId;

      /*
       * With unified projectId system, we don't change URLs based on artifacts
       * The URL should stay as the backend projectId
       */

      let chatSummary: string | undefined = undefined;
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.role === 'assistant') {
        const annotations = lastMessage.annotations as JSONValue[];
        const filteredAnnotations = (annotations?.filter(
          (annotation: JSONValue) =>
            annotation && typeof annotation === 'object' && Object.keys(annotation).includes('type'),
        ) || []) as { type: string; value: any } & { [key: string]: any }[];

        if (filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')) {
          chatSummary = filteredAnnotations.find((annotation) => annotation.type === 'chatSummary')?.summary;
        }
      }

      // Ensure chatId.get() is used here as well
      const finalChatId = chatId.get();

      if (initialMessages.length === 0 && !finalChatId) {
        logger.error('No chatId available when storing messages - this should not happen with the new flow');
        toast.error('Chat session error. Please refresh and try again.');

        return;
      }

      /*
       * Only take snapshot if this is a new message being added, not during page load
       * Skip ALL snapshots during AI streaming since AI response snapshots are now handled in Chat.client.tsx onFinish
       */
      if (!isInitialLoad && messages.length > initialMessages.length) {
        const isCurrentlyStreaming = streamingState.get();

        /*
         * Skip snapshot creation only during active AI streaming
         * AI response snapshots are now centralized to Chat.client.tsx onFinish callback
         * But allow snapshots for user imports (like folder uploads) even if they create assistant messages
         */
        if (!isCurrentlyStreaming) {
          // Determine the appropriate change type based on context
          const lastMessage = messages[messages.length - 1];
          let changeType: ChangeType = 'user-edit';

          // Check if this is an AI response post-completion
          if (lastMessage.role === 'assistant') {
            changeType = 'ai-response';
          }

          takeSnapshot(messages[messages.length - 1].id, workbenchStore.files.get(), _urlId, chatSummary, changeType);
        }
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);

        // Also update the backend project name with the AI-generated title
        updateProjectNameIfNeeded(firstArtifact.title);
      }

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      // Resolve the actual chatId before saving
      const actualChatId = await resolveActualChatId(finalChatId);

      await setMessages(
        db,
        actualChatId, // Use the resolved chatId
        [...archivedMessages, ...messages],
        urlId,
        description.get(),
        undefined,
        chatMetadata.get(),
      );
    },
    duplicateCurrentChat: async (listItemId: string) => {
      if (!db || (!mixedId && !listItemId)) {
        return;
      }

      try {
        const newId = await duplicateChat(db, mixedId || listItemId);

        // Create an initial empty snapshot for the duplicated chat
        try {
          const actualChatId = await resolveActualChatId(newId);
          const hasSnapshots = await hasExistingSnapshots(db, actualChatId);

          if (!hasSnapshots) {
            await createInitialSnapshot(
              db,
              actualChatId,
              `chat-${actualChatId}-initial`,
              'Duplicated chat initial state',
            );
            console.log(`Created initial empty snapshot for duplicated chat ${actualChatId}`);
          }
        } catch (error) {
          console.error('Failed to create initial snapshot for duplicated chat:', error);
        }

        navigateToChat(newId);
        toast.success('Chat duplicated successfully');
      } catch (error) {
        toast.error('Failed to duplicate chat');
        console.log(error);
      }
    },
    importChat: async (description: string, messages: Message[], metadata?: IChatMetadata) => {
      if (!db) {
        return;
      }

      try {
        // Set user upload state to indicate import is in progress
        workbenchStore.setUserUploadInProgress(true);
        console.log('DEBUG: importChat - Starting user upload, setting upload state to true');

        const newId = await createChatFromMessages(db, description, messages, metadata);

        /*
         * For imported chats, we don't create an initial empty snapshot
         * since they may already have content from the imported messages
         * The snapshot will be created when files are uploaded or created
         */

        window.location.href = createChatUrl(newId);
        toast.success('Chat imported successfully');

        // Set a timeout to clear upload state as fallback (in case AI doesn't complete)
        setTimeout(() => {
          if (workbenchStore.isUserUploadInProgress()) {
            workbenchStore.setUserUploadInProgress(false);
            console.log('DEBUG: importChat - Timeout fallback: clearing upload state');
          }
        }, 30000); // 30 second timeout
      } catch (error) {
        // Clear upload state on error
        workbenchStore.setUserUploadInProgress(false);
        console.log('DEBUG: importChat - Error during import, clearing upload state');

        if (error instanceof Error) {
          toast.error('Failed to import chat: ' + error.message);
        } else {
          toast.error('Failed to import chat');
        }
      }
    },
    exportChat: async (id = urlId) => {
      if (!db || !id) {
        return;
      }

      const chat = await getMessages(db, id);
      const chatData = {
        messages: chat.messages,
        description: chat.description,
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  };
}
