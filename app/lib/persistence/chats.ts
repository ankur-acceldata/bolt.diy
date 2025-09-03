/**
 * Functions for managing chat data in IndexedDB
 */

import type { Message } from 'ai';
import type { IChatMetadata } from './db'; // Import IChatMetadata

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  urlId?: string;
  metadata?: IChatMetadata;
}

/**
 * Get all chats from the database
 * @param db The IndexedDB database instance
 * @returns A promise that resolves to an array of chats
 */
export async function getAllChats(db: IDBDatabase): Promise<Chat[]> {
  console.log(`getAllChats: Using database '${db.name}', version ${db.version}`);

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(['chats'], 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result || [];
        console.log(`getAllChats: Found ${result.length} chats in database '${db.name}'`);
        resolve(result);
      };

      request.onerror = () => {
        console.error(`getAllChats: Error querying database '${db.name}':`, request.error);
        reject(request.error);
      };
    } catch (err) {
      console.error(`getAllChats: Error creating transaction on database '${db.name}':`, err);
      reject(err);
    }
  });
}

/**
 * Get a chat by ID
 * @param db The IndexedDB database instance
 * @param id The ID of the chat to get
 * @returns A promise that resolves to the chat or null if not found
 */
export async function getChatById(db: IDBDatabase, id: string): Promise<Chat | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save a chat to the database
 * @param db The IndexedDB database instance
 * @param chat The chat to save
 * @returns A promise that resolves when the chat is saved
 */
export async function saveChat(db: IDBDatabase, chat: Chat): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats'], 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.put(chat);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Delete a chat by ID
 * @param db The IndexedDB database instance
 * @param id The ID of the chat to delete
 * @returns A promise that resolves when the chat is deleted
 */
export async function deleteChat(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots', 'versioned_snapshots', 'snapshot_versions'], 'readwrite');
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');
    const versionedSnapshotStore = transaction.objectStore('versioned_snapshots');
    const versionStore = transaction.objectStore('snapshot_versions');

    let completedOperations = 0;
    const totalOperations = 4; // chats, snapshots, versioned_snapshots cleanup, snapshot_versions

    const checkCompletion = () => {
      completedOperations++;

      if (completedOperations === totalOperations) {
        resolve();
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
      deleteSnapshotRequest.onerror = () => handleError(deleteSnapshotRequest.error);

      // Delete version index
      const deleteVersionRequest = versionStore.delete(id);
      deleteVersionRequest.onsuccess = () => checkCompletion();
      deleteVersionRequest.onerror = () => handleError(deleteVersionRequest.error);

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
       */
      // Delete chat
      const deleteChatRequest = chatStore.delete(id);
      deleteChatRequest.onsuccess = () => checkCompletion();
      deleteChatRequest.onerror = () => handleError(deleteChatRequest.error);

      // Delete regular snapshot
      const deleteSnapshotRequest = snapshotStore.delete(id);
      deleteSnapshotRequest.onsuccess = () => checkCompletion();
      deleteSnapshotRequest.onerror = () => handleError(deleteSnapshotRequest.error);

      // Delete version index (even though get failed, try delete)
      const deleteVersionRequest = versionStore.delete(id);
      deleteVersionRequest.onsuccess = () => checkCompletion();
      deleteVersionRequest.onerror = () => handleError(deleteVersionRequest.error);

      // No versioned snapshots to delete since we couldn't get the index
      checkCompletion();
    };
  });
}

/**
 * Delete all chats
 * @param db The IndexedDB database instance
 * @returns A promise that resolves when all chats are deleted
 */
export async function deleteAllChats(db: IDBDatabase): Promise<void> {
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
        resolve();
      }
    };

    const handleError = (error: any) => {
      reject(error);
    };

    // Clear all stores
    const clearChatsRequest = chatStore.clear();
    clearChatsRequest.onsuccess = () => checkCompletion();
    clearChatsRequest.onerror = () => handleError(clearChatsRequest.error);

    const clearSnapshotsRequest = snapshotStore.clear();
    clearSnapshotsRequest.onsuccess = () => checkCompletion();
    clearSnapshotsRequest.onerror = () => handleError(clearSnapshotsRequest.error);

    const clearVersionedSnapshotsRequest = versionedSnapshotStore.clear();
    clearVersionedSnapshotsRequest.onsuccess = () => checkCompletion();
    clearVersionedSnapshotsRequest.onerror = () => handleError(clearVersionedSnapshotsRequest.error);

    const clearVersionsRequest = versionStore.clear();
    clearVersionsRequest.onsuccess = () => checkCompletion();
    clearVersionsRequest.onerror = () => handleError(clearVersionsRequest.error);
  });
}
