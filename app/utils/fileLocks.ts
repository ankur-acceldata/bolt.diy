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

// Project ID Manager for consistent project ID generation and persistence
class ProjectIdManager {
  private static _instance: ProjectIdManager | null = null;
  private _projectIds: Record<string, string> = {};
  private _initialized = false;
  private readonly _storageKey = 'bolt_project_ids';

  static getInstance(): ProjectIdManager {
    if (!ProjectIdManager._instance) {
      ProjectIdManager._instance = new ProjectIdManager();
    }

    return ProjectIdManager._instance;
  }

  private constructor() {
    this._loadFromStorage();
  }

  private _loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this._storageKey);

        if (stored) {
          this._projectIds = JSON.parse(stored);
        }
      }

      this._initialized = true;
    } catch (error) {
      logger.error('Failed to load project IDs from storage', error);
      this._projectIds = {};
      this._initialized = true;
    }
  }

  private _saveToStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this._storageKey, JSON.stringify(this._projectIds));
      }
    } catch (error) {
      logger.error('Failed to save project IDs to storage', error);
    }
  }

  /**
   * Get or create a project ID for a given chat ID
   * @param chatId The chat ID to get/create project ID for
   * @returns Consistent project ID for the chat
   */
  getProjectId(chatId: string): string {
    if (!this._initialized) {
      this._loadFromStorage();
    }

    // Return existing project ID if available
    if (this._projectIds[chatId]) {
      return this._projectIds[chatId];
    }

    // Generate new project ID for this chat
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this._projectIds[chatId] = projectId;
    this._saveToStorage();

    logger.debug(`Generated new project ID: ${projectId} for chat: ${chatId}`);

    return projectId;
  }

  /**
   * Set a specific project ID for a chat (useful for migrations or external sources)
   * @param chatId The chat ID
   * @param projectId The project ID to set
   */
  setProjectId(chatId: string, projectId: string): void {
    if (!this._initialized) {
      this._loadFromStorage();
    }

    this._projectIds[chatId] = projectId;
    this._saveToStorage();
    logger.debug(`Set project ID: ${projectId} for chat: ${chatId}`);
  }

  /**
   * Remove project ID for a chat (cleanup)
   * @param chatId The chat ID to remove
   */
  removeProjectId(chatId: string): void {
    if (!this._initialized) {
      this._loadFromStorage();
    }

    delete this._projectIds[chatId];
    this._saveToStorage();
    logger.debug(`Removed project ID for chat: ${chatId}`);
  }

  /**
   * Get all project IDs (for debugging)
   */
  getAllProjectIds(): Record<string, string> {
    if (!this._initialized) {
      this._loadFromStorage();
    }

    return { ...this._projectIds };
  }

  /**
   * Clear all project IDs (for testing/reset)
   */
  clearAllProjectIds(): void {
    this._projectIds = {};
    this._saveToStorage();
    logger.debug('Cleared all project IDs');
  }
}

/**
 * Get a consistent project ID for the current chat
 * @param chatId Optional chat ID (will be extracted from URL if not provided)
 * @returns Consistent project ID that persists across reloads
 */
export function getProjectId(chatId?: string): string {
  const currentChatId = chatId || getCurrentChatId();
  const manager = ProjectIdManager.getInstance();

  return manager.getProjectId(currentChatId);
}

/**
 * Set a specific project ID for a chat
 * @param chatId The chat ID
 * @param projectId The project ID to set
 */
export function setProjectId(chatId: string, projectId: string): void {
  const manager = ProjectIdManager.getInstance();
  manager.setProjectId(chatId, projectId);
}

/**
 * Remove project ID for a chat
 * @param chatId The chat ID to remove
 */
export function removeProjectId(chatId: string): void {
  const manager = ProjectIdManager.getInstance();
  manager.removeProjectId(chatId);
}

/**
 * Get all project IDs for debugging
 */
export function getAllProjectIds(): Record<string, string> {
  const manager = ProjectIdManager.getInstance();
  return manager.getAllProjectIds();
}

/**
 * Clear all project IDs (for testing/reset)
 */
export function clearAllProjectIds(): void {
  const manager = ProjectIdManager.getInstance();
  manager.clearAllProjectIds();
}

/**
 * Debug utility to log project ID information
 * @param context Context string for debugging
 */
export function debugProjectId(context: string): void {
  const chatId = getCurrentChatId();
  const projectId = getProjectId(chatId);
  const allProjectIds = getAllProjectIds();

  logger.debug(`[ProjectID Debug - ${context}]`, {
    currentChatId: chatId,
    currentProjectId: projectId,
    allProjectIds,
    timestamp: new Date().toISOString(),
  });
}

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
