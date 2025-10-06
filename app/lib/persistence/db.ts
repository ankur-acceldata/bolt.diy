import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot, VersionedSnapshot, SnapshotVersionIndex, SnapshotVersion, ChangeType } from './types'; // Import all snapshot types

export interface IChatMetadata {
  gitUrl: string;
  gitBranch?: string;
  netlifySiteId?: string;
  projectId?: string;
}

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    logger.error('indexedDB is not available in this environment.');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 4);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: false }); // Remove unique constraint to allow unified IDs
        }
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }

      if (oldVersion < 3) {
        // Add versioned snapshots object store
        if (!db.objectStoreNames.contains('versioned_snapshots')) {
          const versionedStore = db.createObjectStore('versioned_snapshots', { keyPath: 'id' });
          versionedStore.createIndex('chatId', 'chatId', { unique: false });
          versionedStore.createIndex('version', 'version', { unique: false });
          versionedStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Add snapshot version index object store
        if (!db.objectStoreNames.contains('snapshot_versions')) {
          db.createObjectStore('snapshot_versions', { keyPath: 'chatId' });
        }
      }

      if (oldVersion < 4) {
        // Fix urlId index to support unified ID system (remove unique constraint)
        if (db.objectStoreNames.contains('chats')) {
          const transaction = (event.target as IDBOpenDBRequest).transaction!;
          const store = transaction.objectStore('chats');

          // Delete old unique urlId index if it exists
          if (store.indexNames.contains('urlId')) {
            store.deleteIndex('urlId');
          }

          // Create new non-unique urlId index
          store.createIndex('urlId', 'urlId', { unique: false });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  timestamp?: string,
  metadata?: IChatMetadata,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    if (timestamp && isNaN(Date.parse(timestamp))) {
      reject(new Error('Invalid timestamp'));
      return;
    }

    // In unified ID system, urlId should be the same as id
    const finalUrlId = urlId || id;

    logger.debug(`Storing chat - id: ${id}, urlId: ${finalUrlId}`);

    const chatData = {
      id,
      messages,
      urlId: finalUrlId,
      description,
      timestamp: timestamp ?? new Date().toISOString(),
      metadata,
    };

    const request = store.put(chatData);

    request.onsuccess = () => {
      logger.debug(`Successfully stored chat with id: ${id}`);
      resolve();
    };

    request.onerror = () => {
      logger.error(`Failed to store chat with id: ${id}`, request.error);
      reject(request.error);
    };
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  logger.debug(`🔍 getMessages called with id: ${id}`);

  const byId = await getMessagesById(db, id);
  logger.debug(`🔍 getMessagesById result:`, byId ? 'FOUND' : 'NOT FOUND');

  if (byId) {
    logger.debug(`🔍 Returning chat found by ID`);
    return byId;
  }

  const byUrlId = await getMessagesByUrlId(db, id);
  logger.debug(`🔍 getMessagesByUrlId result:`, byUrlId ? 'FOUND' : 'NOT FOUND');

  if (!byId && !byUrlId) {
    logger.error(`❌ BOTH LOOKUPS FAILED for id: ${id}`);
  }

  return byUrlId;
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');

    // Check if urlId index exists
    if (!store.indexNames.contains('urlId')) {
      logger.error(`❌ urlId index does not exist! Available indexes:`, Array.from(store.indexNames));
      resolve(null as any);

      return;
    }

    const index = store.index('urlId');

    // First try string version
    const stringRequest = index.get(id);

    stringRequest.onsuccess = () => {
      if (stringRequest.result) {
        logger.debug(`🔍 Found chat by string urlId: ${id}`);
        resolve(stringRequest.result as ChatHistoryItem);

        return;
      }

      // If string lookup failed, try number version
      const numberRequest = index.get(Number(id));

      numberRequest.onsuccess = () => {
        if (numberRequest.result) {
          logger.debug(`🔍 Found chat by number urlId: ${Number(id)}`);
        } else {
          logger.debug(`🔍 Chat not found by either string (${id}) or number (${Number(id)}) urlId`);
        }

        resolve(numberRequest.result as ChatHistoryItem);
      };

      numberRequest.onerror = () => reject(numberRequest.error);
    };

    stringRequest.onerror = () => reject(stringRequest.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');

    // First try string version
    const stringRequest = store.get(id);

    stringRequest.onsuccess = () => {
      if (stringRequest.result) {
        logger.debug(`🔍 Found chat by string ID: ${id}`);
        resolve(stringRequest.result as ChatHistoryItem);

        return;
      }

      // If string lookup failed, try number version
      const numberRequest = store.get(Number(id));

      numberRequest.onsuccess = () => {
        if (numberRequest.result) {
          logger.debug(`🔍 Found chat by number ID: ${Number(id)}`);
        } else {
          logger.debug(`🔍 Chat not found by either string (${id}) or number (${Number(id)}) ID`);
        }

        resolve(numberRequest.result as ChatHistoryItem);
      };

      numberRequest.onerror = () => reject(numberRequest.error);
    };

    stringRequest.onerror = () => reject(stringRequest.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots', 'versioned_snapshots', 'snapshot_versions'], 'readwrite');
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');
    const versionedSnapshotStore = transaction.objectStore('versioned_snapshots');
    const versionStore = transaction.objectStore('snapshot_versions');

    let completedOperations = 0;
    const totalOperations = 4;

    const checkCompletion = () => {
      completedOperations++;

      if (completedOperations === totalOperations) {
        resolve(undefined);
      }
    };

    const handleError = (error: any) => {
      reject(error);
    };

    /*
     * First get the version index to find all snapshot IDs before deleting anything
     */
    const getVersionRequest = versionStore.get(id);

    getVersionRequest.onsuccess = () => {
      const versionIndex = getVersionRequest.result;

      // Delete chat
      const deleteChatRequest = chatStore.delete(id);
      deleteChatRequest.onsuccess = () => checkCompletion();
      deleteChatRequest.onerror = () => handleError(deleteChatRequest.error);

      // Delete regular snapshot
      const deleteSnapshotRequest = snapshotStore.delete(id);
      deleteSnapshotRequest.onsuccess = () => checkCompletion();

      deleteSnapshotRequest.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          checkCompletion();
        } else {
          handleError(deleteSnapshotRequest.error);
        }
      };

      // Delete version index
      const deleteVersionRequest = versionStore.delete(id);
      deleteVersionRequest.onsuccess = () => checkCompletion();

      deleteVersionRequest.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          checkCompletion();
        } else {
          handleError(deleteVersionRequest.error);
        }
      };

      // Delete all versioned snapshots for this chat
      if (!versionIndex || !versionIndex.versions || versionIndex.versions.length === 0) {
        // No versioned snapshots to delete
        checkCompletion();
        return;
      }

      let deletedSnapshots = 0;
      const totalSnapshots = versionIndex.versions.length;

      for (const versionEntry of versionIndex.versions) {
        const deleteVersionedSnapshotRequest = versionedSnapshotStore.delete(versionEntry.snapshotId);

        deleteVersionedSnapshotRequest.onsuccess = () => {
          deletedSnapshots++;

          if (deletedSnapshots === totalSnapshots) {
            checkCompletion();
          }
        };

        deleteVersionedSnapshotRequest.onerror = () => {
          // Continue even if snapshot deletion fails
          deletedSnapshots++;

          if (deletedSnapshots === totalSnapshots) {
            checkCompletion();
          }
        };
      }
    };

    getVersionRequest.onerror = () => {
      /*
       * If we can't get the version index, still delete the other stores
       * Delete chat
       */
      const deleteChatRequest = chatStore.delete(id);
      deleteChatRequest.onsuccess = () => checkCompletion();
      deleteChatRequest.onerror = () => handleError(deleteChatRequest.error);

      // Delete regular snapshot
      const deleteSnapshotRequest = snapshotStore.delete(id);
      deleteSnapshotRequest.onsuccess = () => checkCompletion();

      deleteSnapshotRequest.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          checkCompletion();
        } else {
          handleError(deleteSnapshotRequest.error);
        }
      };

      // Delete version index (even though get failed, try delete)
      const deleteVersionRequest = versionStore.delete(id);
      deleteVersionRequest.onsuccess = () => checkCompletion();

      deleteVersionRequest.onerror = (event) => {
        if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
          checkCompletion();
        } else {
          handleError(deleteVersionRequest.error);
        }
      };

      // No versioned snapshots to delete since we couldn't get the index
      checkCompletion();
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Create a project via backend API and return the projectId
 * This replaces the old local ID generation
 */
export async function createProjectAndGetId(projectData?: any): Promise<string> {
  try {
    // Import dynamically to avoid circular dependencies
    const { ProjectService: projectService } = await import('~/lib/services/projectService');

    const projectId = await projectService.createProject(projectData || { name: '' });

    logger.debug('Created backend project with ID:', projectId);

    return projectId;
  } catch (error) {
    logger.error('Failed to create backend project:', error);
    throw error;
  }
}

// Keep the old function for any legacy usage but mark as deprecated
/** @deprecated Use createProjectAndGetId instead */
export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Since we're using backend projectId for everything, just return the same ID
 * No need for complex URL ID generation anymore
 */
export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  // With unified projectId approach, urlId and chatId are the same
  return id;
}

// Removed getUrlIds function as it's no longer needed with unified ID system

export async function forkChat(db: IDBDatabase, chatId: string, messageId: string): Promise<string> {
  const chat = await getMessages(db, chatId);

  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(db, chat.description ? `${chat.description} (fork)` : 'Forked chat', messages);
}

export async function duplicateChat(db: IDBDatabase, id: string): Promise<string> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(db, `${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function createChatFromMessages(
  db: IDBDatabase,
  description: string,
  messages: Message[],
  metadata?: IChatMetadata,
): Promise<string> {
  const projectData = {
    name: description || 'Imported Chat Project',
    description: description || 'Imported chat messages',
  };

  const newId = await createProjectAndGetId(projectData);
  const newUrlId = await getUrlId(db, newId); // This will return the same ID in unified system

  await setMessages(
    db,
    newId,
    messages,
    newUrlId,
    description,
    undefined, // Use the current timestamp
    {
      gitUrl: '',
      ...metadata,
      projectId: newId, // Store the projectId in metadata
    },
  );

  return newUrlId; // Return the projectId for navigation
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  if (!description.trim()) {
    throw new Error('Description cannot be empty');
  }

  await setMessages(db, id, chat.messages, chat.urlId, description, chat.timestamp, chat.metadata);
}

export async function updateChatMetadata(
  db: IDBDatabase,
  id: string,
  metadata: IChatMetadata | undefined,
): Promise<void> {
  const chat = await getMessages(db, id);

  if (!chat) {
    throw new Error('Chat not found');
  }

  await setMessages(db, id, chat.messages, chat.urlId, chat.description, chat.timestamp, metadata);
}

export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}

// Versioned Snapshot Functions

export async function setVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
  snapshot: VersionedSnapshot,
  version: number,
  changeType: ChangeType,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['versioned_snapshots', 'snapshot_versions'], 'readwrite');
    const snapshotStore = transaction.objectStore('versioned_snapshots');
    const versionStore = transaction.objectStore('snapshot_versions');

    const snapshotId = `${chatId}-${version}`;
    const versionedSnapshot: VersionedSnapshot = {
      ...snapshot,
      version,
      changeType,
      timestamp: Date.now(),
    };

    // Store the versioned snapshot
    const snapshotRequest = snapshotStore.put({
      id: snapshotId,
      chatId,
      version,
      timestamp: versionedSnapshot.timestamp,
      changeType,
      snapshot: versionedSnapshot,
    });

    snapshotRequest.onsuccess = () => {
      // Update the version index
      const versionRequest = versionStore.get(chatId);

      versionRequest.onsuccess = () => {
        const versionIndex: SnapshotVersionIndex = versionRequest.result || {
          chatId,
          versions: [],
          latestVersion: 0,
        };

        const newVersionEntry: SnapshotVersion = {
          chatId,
          version,
          timestamp: versionedSnapshot.timestamp,
          changeType,
          snapshotId,
        };

        // Update version index
        versionIndex.versions.push(newVersionEntry);
        versionIndex.latestVersion = Math.max(versionIndex.latestVersion, version);

        // Sort versions by version number
        versionIndex.versions.sort((a, b) => a.version - b.version);

        const updateVersionRequest = versionStore.put(versionIndex);
        updateVersionRequest.onsuccess = () => resolve();
        updateVersionRequest.onerror = () => reject(updateVersionRequest.error);
      };

      versionRequest.onerror = () => reject(versionRequest.error);
    };

    snapshotRequest.onerror = () => reject(snapshotRequest.error);
  });
}

export async function getSnapshotVersions(db: IDBDatabase, chatId: string): Promise<SnapshotVersionIndex | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshot_versions', 'readonly');
    const store = transaction.objectStore('snapshot_versions');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result as SnapshotVersionIndex | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
  version: number,
): Promise<VersionedSnapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('versioned_snapshots', 'readonly');
    const store = transaction.objectStore('versioned_snapshots');
    const snapshotId = `${chatId}-${version}`;
    const request = store.get(snapshotId);

    request.onsuccess = () => resolve(request.result?.snapshot as VersionedSnapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getLatestVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
): Promise<VersionedSnapshot | undefined> {
  const versionIndex = await getSnapshotVersions(db, chatId);

  if (!versionIndex || versionIndex.versions.length === 0) {
    return undefined;
  }

  const latestVersion = versionIndex.latestVersion;

  return getVersionedSnapshot(db, chatId, latestVersion);
}

export async function deleteVersionedSnapshots(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['versioned_snapshots', 'snapshot_versions'], 'readwrite');
    const snapshotStore = transaction.objectStore('versioned_snapshots');
    const versionStore = transaction.objectStore('snapshot_versions');

    // Get all versions for this chat
    const versionRequest = versionStore.get(chatId);

    versionRequest.onsuccess = () => {
      const versionIndex: SnapshotVersionIndex = versionRequest.result;

      if (!versionIndex) {
        resolve();

        return;
      }

      let deletedCount = 0;
      const totalToDelete = versionIndex.versions.length;

      if (totalToDelete === 0) {
        // Delete version index
        const deleteVersionRequest = versionStore.delete(chatId);
        deleteVersionRequest.onsuccess = () => resolve();
        deleteVersionRequest.onerror = () => reject(deleteVersionRequest.error);

        return;
      }

      const checkCompletion = () => {
        if (deletedCount === totalToDelete) {
          // Delete version index
          const deleteVersionRequest = versionStore.delete(chatId);
          deleteVersionRequest.onsuccess = () => resolve();
          deleteVersionRequest.onerror = () => reject(deleteVersionRequest.error);
        }
      };

      // Delete all snapshots for this chat
      for (const versionEntry of versionIndex.versions) {
        const deleteSnapshotRequest = snapshotStore.delete(versionEntry.snapshotId);

        deleteSnapshotRequest.onsuccess = () => {
          deletedCount++;
          checkCompletion();
        };

        deleteSnapshotRequest.onerror = () => {
          // Continue even if deletion fails
          deletedCount++;
          checkCompletion();
        };
      }
    };

    versionRequest.onerror = () => reject(versionRequest.error);
  });
}

export async function getNextSnapshotVersion(db: IDBDatabase, chatId: string): Promise<number> {
  const versionIndex = await getSnapshotVersions(db, chatId);

  if (!versionIndex) {
    return 1;
  }

  return versionIndex.latestVersion + 1;
}
