/**
 * Bolt.diy Sync Adapter Integration
 * Hooks into Bolt's existing file system to provide universal sync capabilities
 */

import { BoltFileSystemAdapter } from '@fern-fs/adapter/adapters/bolt-adapter';
import { SyncManager } from '@fern-fs/adapter/core/sync-manager';
import { UniversalFileNode } from '@fern-fs/adapter/core/interfaces';
import { openDatabase, getSnapshot, setSnapshot } from '~/lib/persistence/db';
import type { FilesStore } from '~/lib/stores/files';

export interface BoltSyncIntegrationOptions {
  filesStore: FilesStore;
  chatId: string;
  remoteUrl?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export class BoltSyncIntegration {
  private _adapter: BoltFileSystemAdapter | null = null;
  private _syncManager: SyncManager | null = null;
  private _filesStore: FilesStore;
  private _chatId: string;
  private _options: BoltSyncIntegrationOptions;
  private _isInitialized = false;

  constructor(options: BoltSyncIntegrationOptions) {
    this._options = options;
    this._filesStore = options.filesStore;
    this._chatId = options.chatId;
  }

  /**
   * Initialize the sync integration
   */
  async initialize(): Promise<void> {
    if (this._isInitialized) {
      return;
    }

    try {
      // Create Bolt database wrapper
      const boltDb = {
        openDatabase,
        getSnapshot,
        setSnapshot,
      };

      // Create Bolt adapter
      this._adapter = new BoltFileSystemAdapter({
        chatId: this._chatId,
        boltDb,
        filesStore: this._filesStore,
      });

      // Create sync manager
      this._syncManager = new SyncManager({
        autoSync: this._options.autoSync ?? true,
        syncInterval: this._options.syncInterval ?? 30000,
        conflictResolution: 'ask',
        excludePatterns: ['node_modules/**', '.git/**', '**/*.tmp', '**/.DS_Store'],
      });

      // Register the adapter
      await this._syncManager.registerAdapter(this._adapter);

      // Set up remote backend if URL provided
      if (this._options.remoteUrl) {
        await this._setupRemoteSync(this._options.remoteUrl);
      }

      // Hook into FilesStore changes
      this.setupFilesStoreHooks();

      // Start sync
      await this._syncManager.startSync();

      this._isInitialized = true;
      console.log('Bolt sync integration initialized');
    } catch (error) {
      console.error('Failed to initialize Bolt sync integration:', error);
      throw error;
    }
  }

  /**
   * Dispose of the sync integration
   */
  async dispose(): Promise<void> {
    if (this._syncManager) {
      await this._syncManager.dispose();
      this._syncManager = null;
    }

    this._adapter = null;
    this._isInitialized = false;
  }

  /**
   * Force sync with remote
   */
  async forceSync(): Promise<void> {
    if (!this._syncManager) {
      throw new Error('Sync manager not initialized');
    }

    try {
      const result = await this._syncManager.forcSync();

      if (!result.success) {
        console.error('Force sync failed:', result.errors);
      }

      return result;
    } catch (error) {
      console.error('Force sync error:', error);
      throw error;
    }
  }

  /**
   * Update chat ID and reinitialize
   */
  async updateChatId(newChatId: string): Promise<void> {
    this._chatId = newChatId;

    if (this._adapter) {
      this._adapter.setChatId(newChatId);
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isRunning: boolean;
    lastSync: number | null;
    pendingChanges: number;
    connected: boolean;
  } {
    if (!this._syncManager) {
      return {
        isRunning: false,
        lastSync: null,
        pendingChanges: 0,
        connected: false,
      };
    }

    return {
      isRunning: this._syncManager.isRunning(),
      lastSync: this._syncManager.getLastSync(),
      pendingChanges: this._syncManager.getPendingChanges().length,
      connected: this._syncManager.backend?.connected ?? false,
    };
  }

  /**
   * Enable or disable auto sync
   */
  setAutoSync(enabled: boolean): void {
    if (this._syncManager) {
      this._syncManager.updateConfig({ autoSync: enabled });
    }
  }

  /**
   * Get locked files for current chat
   */
  async getLockedFiles(): Promise<string[]> {
    if (!this._adapter) {
      return [];
    }

    return await this._adapter.getLockedFiles();
  }

  /**
   * Check if file is locked
   */
  async isFileLocked(path: string): Promise<boolean> {
    if (!this._adapter) {
      return false;
    }

    return await this._adapter.isFileLocked(path);
  }

  /**
   * Listen for sync events
   */
  onSyncEvent<K extends keyof import('@fern-fs/adapter/core/interfaces').SyncEvents>(
    event: K,
    callback: (data: import('@fern-fs/adapter/core/interfaces').SyncEvents[K]) => void,
  ): () => void {
    if (!this._syncManager) {
      return () => {
        // No-op cleanup function
      };
    }

    this._syncManager.on(event, callback);

    return () => this._syncManager?.off(event, callback);
  }

  private async _setupRemoteSync(remoteUrl: string): Promise<void> {
    if (!this._syncManager) {
      return;
    }

    try {
      const { FernWebSocketBackend: fernWebSocketBackend } = await import(
        '@fern-fs/adapter/backends/fern-websocket-backend'
      );
      const backend = new fernWebSocketBackend(remoteUrl);

      await this._syncManager.setBackend(backend);
      await backend.connect();
    } catch (error) {
      console.error('Failed to setup remote sync:', error);
    }
  }

  private _setupFilesStoreHooks(): void {
    if (!this._filesStore || !this._syncManager) {
      return;
    }

    // Subscribe to file changes in FilesStore
    this._filesStore.files.subscribe((newFiles) => {
      this._handleFilesStoreChange(newFiles);
    });

    // Hook into file operations
    const originalSaveFile = this._filesStore.saveFile.bind(this._filesStore);

    this._filesStore.saveFile = async (filePath: string, content: string) => {
      const result = await originalSaveFile(filePath, content);
      await this._handleFileUpdate(filePath, content);

      return result;
    };

    const originalCreateFile = this._filesStore.createFile.bind(this._filesStore);

    this._filesStore.createFile = async (filePath: string, content: string | Uint8Array = '') => {
      const result = await originalCreateFile(filePath, content);
      await this._handleFileCreate(filePath, content);

      return result;
    };

    const originalDeleteFile = this._filesStore.deleteFile.bind(this._filesStore);

    this._filesStore.deleteFile = async (filePath: string) => {
      const result = await originalDeleteFile(filePath);
      await this._handleFileDelete(filePath);

      return result;
    };
  }

  private async _handleFilesStoreChange(_newFiles: any): Promise<void> {
    /*
     * This is called when the entire files object changes
     * We'll let the adapter handle this through its own watching mechanism
     */
  }

  private async _handleFileUpdate(filePath: string, content: string): Promise<void> {
    if (!this._adapter) {
      return;
    }

    try {
      // Create universal file node
      const node: UniversalFileNode = {
        id: `bolt:${filePath}:${Date.now()}`,
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        type: 'file',
        content,
        size: content.length,
        lastModified: Date.now(),
        syncStatus: 'pending',
        metadata: {
          source: 'bolt',
          chatId: this._chatId,
        },
      };

      // Let the adapter handle the change through its change detector
      await this._adapter.writeFile(node);
    } catch (error) {
      console.error('Error handling file update:', error);
    }
  }

  private async _handleFileCreate(filePath: string, content: string | Uint8Array): Promise<void> {
    const stringContent = content instanceof Uint8Array ? Buffer.from(content).toString('base64') : content;

    await this._handleFileUpdate(filePath, stringContent);
  }

  private async _handleFileDelete(filePath: string): Promise<void> {
    if (!this._adapter) {
      return;
    }

    try {
      await this._adapter.deleteFile(filePath);
    } catch (error) {
      console.error('Error handling file delete:', error);
    }
  }
}

// Singleton instance
let syncIntegration: BoltSyncIntegration | null = null;

/**
 * Initialize Bolt sync integration
 */
export async function initializeBoltSync(options: BoltSyncIntegrationOptions): Promise<BoltSyncIntegration> {
  if (syncIntegration) {
    await syncIntegration.dispose();
  }

  syncIntegration = new BoltSyncIntegration(options);
  await syncIntegration.initialize();

  return syncIntegration;
}

/**
 * Get current sync integration instance
 */
export function getBoltSyncIntegration(): BoltSyncIntegration | null {
  return syncIntegration;
}

/**
 * Dispose current sync integration
 */
export async function disposeBoltSync(): Promise<void> {
  if (syncIntegration) {
    await syncIntegration.dispose();
    syncIntegration = null;
  }
}
