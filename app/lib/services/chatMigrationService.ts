import { createScopedLogger } from '~/utils/logger';
import { openDatabase, getAll } from '~/lib/persistence/db';
import { BackendPersistenceService } from './backendPersistenceService';
import { logStore } from '~/lib/stores/logs';

const logger = createScopedLogger('ChatMigrationService');

export interface MigrationResult {
  success: boolean;
  totalChats: number;
  migratedChats: number;
  failedChats: number;
  errors: Array<{ chatId: string; error: string }>;
}

/**
 * Service for migrating existing IndexedDB chats to backend storage
 */
export class ChatMigrationService {
  /**
   * Migrate all chats from IndexedDB to backend
   * This is a one-time migration utility
   */
  static async migrateAllChats(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      totalChats: 0,
      migratedChats: 0,
      failedChats: 0,
      errors: [],
    };

    try {
      logger.info('Starting chat migration from IndexedDB to backend...');
      logStore.logSystem('[MIGRATION] Starting chat migration from IndexedDB to backend');

      // Open IndexedDB
      const db = await openDatabase();

      if (!db) {
        logger.error('Failed to open IndexedDB for migration');
        logStore.logError('[MIGRATION] Failed to open IndexedDB', new Error('Database not available'));

        return result;
      }

      // Get all chats from IndexedDB
      const chats = await getAll(db);
      result.totalChats = chats.length;

      logger.info(`Found ${chats.length} chats to migrate`);
      logStore.logSystem('[MIGRATION] Found chats to migrate', { totalChats: chats.length });

      // Migrate each chat
      for (const chat of chats) {
        try {
          logger.info(`Migrating chat ${chat.id}...`);
          logStore.logSystem('[MIGRATION] Migrating chat', {
            chatId: chat.id,
            messageCount: chat.messages.length,
          });

          await BackendPersistenceService.saveChat(chat.id, chat.messages, chat.description, chat.metadata);

          result.migratedChats++;
          logger.info(`Successfully migrated chat ${chat.id}`);
          logStore.logSystem('[MIGRATION] Chat migrated successfully', { chatId: chat.id });
        } catch (error) {
          result.failedChats++;

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push({ chatId: chat.id, error: errorMessage });

          logger.error(`Failed to migrate chat ${chat.id}:`, error);
          logStore.logError('[MIGRATION] Failed to migrate chat', error);
        }
      }

      result.success = result.failedChats === 0;

      logger.info(
        `Migration completed: ${result.migratedChats}/${result.totalChats} successful, ${result.failedChats} failed`,
      );
      logStore.logSystem('[MIGRATION] Migration completed', {
        totalChats: result.totalChats,
        migratedChats: result.migratedChats,
        failedChats: result.failedChats,
      });

      return result;
    } catch (error) {
      logger.error('Migration failed:', error);
      logStore.logError('[MIGRATION] Migration failed', error);

      return result;
    }
  }

  /**
   * Migrate a single chat from IndexedDB to backend
   */
  static async migrateSingleChat(chatId: string): Promise<boolean> {
    try {
      logger.info(`Migrating single chat ${chatId}...`);
      logStore.logSystem('[MIGRATION] Migrating single chat', { chatId });

      const db = await openDatabase();

      if (!db) {
        logger.error('Failed to open IndexedDB');
        return false;
      }

      // Get chat from IndexedDB
      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(chatId);

      const chat = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!chat) {
        logger.warn(`Chat ${chatId} not found in IndexedDB`);
        return false;
      }

      // Migrate to backend
      await BackendPersistenceService.saveChat(chat.id, chat.messages, chat.description, chat.metadata);

      logger.info(`Successfully migrated chat ${chatId}`);
      logStore.logSystem('[MIGRATION] Single chat migrated successfully', { chatId });

      return true;
    } catch (error) {
      logger.error(`Failed to migrate chat ${chatId}:`, error);
      logStore.logError('[MIGRATION] Failed to migrate single chat', error);

      return false;
    }
  }

  /**
   * Check if a chat exists in backend
   */
  static async isChatMigrated(chatId: string): Promise<boolean> {
    try {
      const backendChat = await BackendPersistenceService.loadChat(chatId);
      return backendChat !== null && backendChat.messages.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get migration status for all chats
   */
  static async getMigrationStatus(): Promise<{
    totalChats: number;
    migratedChats: number;
    unmigratedChats: number;
  }> {
    try {
      const db = await openDatabase();

      if (!db) {
        return { totalChats: 0, migratedChats: 0, unmigratedChats: 0 };
      }

      const chats = await getAll(db);
      let migratedCount = 0;

      for (const chat of chats) {
        const isMigrated = await this.isChatMigrated(chat.id);

        if (isMigrated) {
          migratedCount++;
        }
      }

      return {
        totalChats: chats.length,
        migratedChats: migratedCount,
        unmigratedChats: chats.length - migratedCount,
      };
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      return { totalChats: 0, migratedChats: 0, unmigratedChats: 0 };
    }
  }

  /**
   * Verify migration integrity by comparing IndexedDB and backend data
   */
  static async verifyMigration(chatId: string): Promise<{
    isValid: boolean;
    indexedDBMessageCount: number;
    backendMessageCount: number;
    differences: string[];
  }> {
    const result = {
      isValid: true,
      indexedDBMessageCount: 0,
      backendMessageCount: 0,
      differences: [] as string[],
    };

    try {
      // Get from IndexedDB
      const db = await openDatabase();

      if (!db) {
        result.differences.push('IndexedDB not available');
        result.isValid = false;

        return result;
      }

      const transaction = db.transaction('chats', 'readonly');
      const store = transaction.objectStore('chats');
      const request = store.get(chatId);

      const indexedDBChat = await new Promise<any>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!indexedDBChat) {
        result.differences.push('Chat not found in IndexedDB');
        result.isValid = false;

        return result;
      }

      result.indexedDBMessageCount = indexedDBChat.messages.length;

      // Get from backend
      const backendChat = await BackendPersistenceService.loadChat(chatId);

      if (!backendChat) {
        result.differences.push('Chat not found in backend');
        result.isValid = false;

        return result;
      }

      result.backendMessageCount = backendChat.messages.length;

      // Compare message counts
      if (result.indexedDBMessageCount !== result.backendMessageCount) {
        result.differences.push(
          `Message count mismatch: IndexedDB has ${result.indexedDBMessageCount}, backend has ${result.backendMessageCount}`,
        );
        result.isValid = false;
      }

      // Compare message IDs
      const indexedDBMessageIds = indexedDBChat.messages.map((m: any) => m.id);
      const backendMessageIds = backendChat.messages.map((m) => m.id);

      const missingInBackend = indexedDBMessageIds.filter((id: string) => !backendMessageIds.includes(id));
      const extraInBackend = backendMessageIds.filter((id) => !indexedDBMessageIds.includes(id));

      if (missingInBackend.length > 0) {
        result.differences.push(`Messages missing in backend: ${missingInBackend.join(', ')}`);
        result.isValid = false;
      }

      if (extraInBackend.length > 0) {
        result.differences.push(`Extra messages in backend: ${extraInBackend.join(', ')}`);
        result.isValid = false;
      }

      return result;
    } catch (error) {
      result.differences.push(`Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;

      return result;
    }
  }
}
