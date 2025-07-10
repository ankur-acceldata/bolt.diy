import {
  getLockedItems,
  isFileLocked as isFileLockedInternal,
  isFolderLocked as isFolderLockedInternal,
  isPathInLockedFolder,
} from '~/lib/persistence/lockedFiles';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('FileLocks');

// Cache for chatId resolution to avoid repeated database calls
let chatIdCache: Record<string, string> = {};

/**
 * Get the current chat ID from the URL, resolving urlId to actual chatId
 * @returns The actual chatId from the database, not the URL ID
 */
export function getCurrentChatId(): string {
  try {
    if (typeof window !== 'undefined') {
      // Extract ID from URL (format: /chat/123)
      const match = window.location.pathname.match(/\/chat\/([^/]+)/);

      if (match && match[1]) {
        const urlId = match[1];

        // Check cache first
        if (chatIdCache[urlId]) {
          return chatIdCache[urlId];
        }

        /*
         * Return the urlId as-is initially, but we'll resolve it async
         * This prevents circular dependencies while still providing a valid ID
         */
        return urlId;
      }
    }

    // Return a default chat ID if none is found
    return 'default';
  } catch (error) {
    logger.error('Failed to get current chat ID', error);
    return 'default';
  }
}

/**
 * Resolve a mixed ID (could be chatId or urlId) to the actual chatId
 * @param mixedId The ID from the URL which could be chatId or urlId
 * @returns Promise resolving to the actual chatId
 */
export async function resolveActualChatId(mixedId: string): Promise<string> {
  try {
    // Check cache first
    if (chatIdCache[mixedId]) {
      return chatIdCache[mixedId];
    }

    // Dynamic import to avoid circular dependencies
    const { getMessages } = await import('~/lib/persistence/db');
    const { db } = await import('~/lib/persistence/useChatHistory');

    if (!db) {
      return mixedId;
    }

    // Try to get the chat data
    const chatData = await getMessages(db, mixedId);

    if (chatData && chatData.id) {
      // Cache the resolution
      chatIdCache[mixedId] = chatData.id;

      // Also cache the reverse mapping if we have a urlId
      if (chatData.urlId && chatData.urlId !== chatData.id) {
        chatIdCache[chatData.urlId] = chatData.id;
      }

      return chatData.id;
    }

    // If no chat data found, assume it's already a chatId
    return mixedId;
  } catch (error) {
    logger.error('Failed to resolve chat ID', error);
    return mixedId;
  }
}

/**
 * Clear the chat ID cache (useful for testing or when chat data changes)
 */
export function clearChatIdCache(): void {
  chatIdCache = {};
}

/**
 * Check if a file is locked directly from localStorage
 * This avoids circular dependencies between components and stores
 * @param filePath The path of the file to check
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 */
export function isFileLocked(filePath: string, chatId?: string): { locked: boolean; lockedBy?: string } {
  try {
    const currentChatId = chatId || getCurrentChatId();

    // Use the internal function from lockedFiles.ts
    const result = isFileLockedInternal(currentChatId, filePath);

    // If the file itself is not locked, check if it's in a locked folder
    if (!result.locked) {
      const folderLockResult = isPathInLockedFolder(currentChatId, filePath);

      if (folderLockResult.locked) {
        return folderLockResult;
      }
    }

    return result;
  } catch (error) {
    logger.error('Failed to check if file is locked', error);
    return { locked: false };
  }
}

/**
 * Check if a folder is locked directly from localStorage
 * This avoids circular dependencies between components and stores
 * @param folderPath The path of the folder to check
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 */
export function isFolderLocked(folderPath: string, chatId?: string): { locked: boolean; lockedBy?: string } {
  try {
    const currentChatId = chatId || getCurrentChatId();

    // Use the internal function from lockedFiles.ts
    return isFolderLockedInternal(currentChatId, folderPath);
  } catch (error) {
    logger.error('Failed to check if folder is locked', error);
    return { locked: false };
  }
}

/**
 * Check if any files are locked in the current chat
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 * @returns True if any files or folders are locked
 */
export function hasLockedItems(chatId?: string): boolean {
  try {
    const currentChatId = chatId || getCurrentChatId();
    const lockedItems = getLockedItems();

    return lockedItems.some((item) => item.chatId === currentChatId);
  } catch (error) {
    logger.error('Failed to check for locked items', error);
    return false;
  }
}
