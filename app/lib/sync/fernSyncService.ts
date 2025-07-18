/**
 * Fern API Sync Service
 * Replaces direct browser file system sync with Golang API and Minio integration
 */

import { logStore } from '~/lib/stores/logs';
import { fernApiService, type SyncResult } from '~/lib/services/fernApiService';
import type { WorkbenchStore } from '~/lib/stores/workbench';

export interface FernSyncOptions {
  workbenchStore: WorkbenchStore;
  chatId: string;
  serverUrl?: string;
  wsUrl?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export class FernSyncService {
  private _options: FernSyncOptions;
  private _isRunning = false;
  private _lastSync: number | null = null;
  private _listeners = new Map<string, ((data?: any) => void)[]>();
  private _intervalId: NodeJS.Timeout | null = null;
  private _isServerAvailable = false;
  private _pendingChanges = new Set<string>();
  private _autoSaveTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(options: FernSyncOptions) {
    this._options = options;

    // Configure API service
    if (options.serverUrl || options.wsUrl) {
      fernApiService.updateConfig(options.serverUrl, options.wsUrl);
    }
  }

  async initialize(): Promise<void> {
    logStore.logSystem('Initializing Fern sync service...');

    try {
      // Check if Golang server is available
      this._isServerAvailable = await fernApiService.isServerAvailable();

      if (!this._isServerAvailable) {
        throw new Error('Fern API server is not available. Please ensure the Golang server is running.');
      }

      // Set up WebSocket connection for real-time sync
      await this._setupWebSocket();

      // Set up file watching for auto-save
      this._setupFileWatching();

      // Start auto-sync if enabled
      if (this._options.autoSync) {
        this._startAutoSync();
      }

      logStore.logSystem('Fern sync service initialized successfully');

      // Removed toast - using status indicator instead
    } catch (error) {
      logStore.logError('Failed to initialize Fern sync service', error);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    this._stopAutoSync();
    this._clearAutoSaveTimeouts();
    fernApiService.disconnectWebSocket();
    this._listeners.clear();
    logStore.logSystem('Fern sync service disposed');
  }

  async forceSync(): Promise<SyncResult> {
    logStore.logSystem('Force sync requested with Fern API');

    try {
      this._isRunning = true;
      this._emit('sync-started', {});

      // Get current files from workbench
      const files = this._options.workbenchStore.files.get();
      const localFiles: { [path: string]: { content: string; lastModified?: number } } = {};

      // Convert workbench files to sync format
      for (const [path, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file' && !dirent.isBinary && dirent.content) {
          localFiles[path] = {
            content: dirent.content,
            lastModified: Date.now(), // Use current time as modification time
          };
        }
      }

      // Perform sync with Golang API
      const result = await fernApiService.syncFiles(localFiles);

      this._lastSync = Date.now();
      this._isRunning = false;
      this._pendingChanges.clear();

      this._emit('sync-completed', {
        changesApplied: result.filesUpdated,
        success: result.success,
        errors: result.errors,
      });

      if (result.success) {
        logStore.logSystem(`Sync completed: ${result.filesUpdated} files synced to Minio`);
      } else {
        logStore.logError('Sync completed with errors', result.errors);
      }

      return result;
    } catch (error) {
      this._isRunning = false;
      this._emit('sync-error', { message: (error as Error).message });
      logStore.logError('Force sync failed', error);
      throw error;
    }
  }

  setAutoSync(enabled: boolean): void {
    this._options.autoSync = enabled;

    if (enabled) {
      this._startAutoSync();
    } else {
      this._stopAutoSync();
    }
  }

  getSyncStatus() {
    return {
      isRunning: this._isRunning,
      lastSync: this._lastSync,
      pendingChanges: this._pendingChanges.size,
      connected: fernApiService.isWebSocketConnected() && this._isServerAvailable,
    };
  }

  updateConfig(config: Partial<FernSyncOptions>): void {
    this._options = { ...this._options, ...config };

    if (config.serverUrl || config.wsUrl) {
      fernApiService.updateConfig(config.serverUrl, config.wsUrl);
    }

    if (this._options.autoSync) {
      this._startAutoSync();
    }
  }

  setChatId(chatId: string): void {
    this._options.chatId = chatId;
  }

  async getLockedFiles(): Promise<string[]> {
    // For now, return empty array as we don't have file locking in Fern API
    return [];
  }

  async isFileLocked(_path: string): Promise<boolean> {
    return false; // No file locking implemented yet
  }

  on(event: string, callback: (data?: any) => void): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }

    this._listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (data?: any) => void): void {
    const callbacks = this._listeners.get(event);

    if (callbacks) {
      const index = callbacks.indexOf(callback);

      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private _emit(event: string, data: any): void {
    const callbacks = this._listeners.get(event);

    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in sync event callback:', error);
        }
      });
    }
  }

  private async _setupWebSocket(): Promise<void> {
    try {
      await fernApiService.connectWebSocket(
        (data) => this._handleWebSocketMessage(data),
        (error) => this._handleWebSocketError(error),
      );

      this._emit('connection-changed', true);
    } catch (error) {
      logStore.logError('Failed to setup WebSocket connection', error);
      this._emit('connection-changed', false);
    }
  }

  private _handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'file_changed':
        this._handleRemoteFileChange(data);
        break;
      case 'sync_status':
        this._handleSyncStatus(data);
        break;
      case 'connection_status':
        this._emit('connection-changed', data.connected);
        break;
      default:
        logStore.logSystem(`Unknown WebSocket message type: ${data.type}`);
    }
  }

  private _handleWebSocketError(error: Event): void {
    logStore.logError('WebSocket error', error);
    this._emit('connection-changed', false);
  }

  private _handleRemoteFileChange(data: any): void {
    if (data.path && data.operation) {
      logStore.logSystem(`Remote file change: ${data.operation} on ${data.path}`);

      // Emit file change event for UI updates
      this._emit('remote-change', {
        path: data.path,
        operation: data.operation,
        content: data.content,
      });
    }
  }

  private _handleSyncStatus(data: any): void {
    if (data.status === 'completed') {
      this._lastSync = Date.now();
      this._emit('sync-completed', { changesApplied: data.changes || 0 });
    }
  }

  private _setupFileWatching(): void {
    // Watch for file changes in the workbench store
    this._options.workbenchStore.files.subscribe((newFiles) => {
      this._handleFilesChange(newFiles);
    });
  }

  private _handleFilesChange(files: any): void {
    // Track changes for auto-save
    for (const [path, dirent] of Object.entries(files)) {
      if (dirent && typeof dirent === 'object' && 'type' in dirent && dirent.type === 'file') {
        this._scheduleAutoSave(path);
      }
    }
  }

  private _scheduleAutoSave(path: string): void {
    // Clear existing timeout for this file
    const existingTimeout = this._autoSaveTimeouts.get(path);

    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule auto-save after a short delay (debouncing)
    const timeout = setTimeout(async () => {
      await this._autoSaveFile(path);
      this._autoSaveTimeouts.delete(path);
    }, 2000); // 2 second delay for auto-save

    this._autoSaveTimeouts.set(path, timeout);
    this._pendingChanges.add(path);
  }

  private async _autoSaveFile(path: string): Promise<void> {
    try {
      const files = this._options.workbenchStore.files.get();
      const file = files[path];

      if (file && file.type === 'file' && !file.isBinary && file.content) {
        await fernApiService.saveFile(path, file.content);
        logStore.logSystem(`Auto-saved file: ${path}`);

        this._pendingChanges.delete(path);
        this._emit('file-saved', { path, content: file.content });

        // Removed toast - using status indicator instead
      }
    } catch (error) {
      logStore.logError(`Failed to auto-save file ${path}`, error);
      this._emit('auto-save-error', { path, error: (error as Error).message });
    }
  }

  private _startAutoSync(): void {
    this._stopAutoSync();

    if (this._options.syncInterval && this._options.syncInterval > 0) {
      this._intervalId = setInterval(() => {
        if (!this._isRunning && this._pendingChanges.size > 0) {
          this.forceSync().catch((error) => {
            logStore.logError('Auto sync failed', error);
          });
        }
      }, this._options.syncInterval);

      logStore.logSystem(`Auto-sync started with interval: ${this._options.syncInterval}ms`);
    }
  }

  private _stopAutoSync(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      logStore.logSystem('Auto-sync stopped');
    }
  }

  private _clearAutoSaveTimeouts(): void {
    for (const timeout of this._autoSaveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this._autoSaveTimeouts.clear();
  }
}

// Global service instance
let fernSyncService: FernSyncService | null = null;

export async function initializeFernSync(options: FernSyncOptions): Promise<FernSyncService> {
  if (fernSyncService) {
    await fernSyncService.dispose();
  }

  fernSyncService = new FernSyncService(options);
  await fernSyncService.initialize();

  return fernSyncService;
}

export function getFernSyncService(): FernSyncService | null {
  return fernSyncService;
}

export async function disposeFernSync(): Promise<void> {
  if (fernSyncService) {
    await fernSyncService.dispose();
    fernSyncService = null;
  }
}
