/**
 * Sync stub implementation for when full sync adapter is not available
 * Provides basic sync functionality without complex dependencies
 */

import { toast } from 'react-toastify';
import { logStore } from '~/lib/stores/logs';

export interface SyncStubOptions {
  filesStore: any; // Using any for now to avoid type issues
  chatId: string;
  remoteUrl?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export class SyncStub {
  private _options: SyncStubOptions;
  private _isRunning = false;
  private _lastSync: number | null = null;
  private _listeners = new Map<string, ((data?: any) => void)[]>();
  private _intervalId: NodeJS.Timeout | null = null;

  constructor(options: SyncStubOptions) {
    this._options = options;
  }

  async initialize(): Promise<void> {
    logStore.logSystem('Initializing sync stub (limited functionality)');

    if (this._options.autoSync) {
      this._startAutoSync();
    }

    toast.info('Sync enabled with basic functionality');
  }

  async dispose(): Promise<void> {
    this._stopAutoSync();
    this._listeners.clear();
    logStore.logSystem('Sync stub disposed');
  }

  async forceSync(): Promise<{ success: boolean; errors?: string[] }> {
    logStore.logSystem('Force sync requested (stub implementation)');

    try {
      this._isRunning = true;
      this._emit('sync-started', {});

      // Simulate sync delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      this._lastSync = Date.now();
      this._isRunning = false;

      this._emit('sync-completed', { changesApplied: 0 });

      return { success: true };
    } catch (error) {
      this._isRunning = false;
      this._emit('sync-error', { message: (error as Error).message });

      return { success: false, errors: [(error as Error).message] };
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
      pendingChanges: 0,
      connected: false, // Stub doesn't support remote connections
    };
  }

  updateConfig(config: Partial<SyncStubOptions>): void {
    this._options = { ...this._options, ...config };

    if (this._options.autoSync) {
      this._startAutoSync();
    }
  }

  setChatId(chatId: string): void {
    this._options.chatId = chatId;
  }

  async getLockedFiles(): Promise<string[]> {
    return [];
  }

  async isFileLocked(_path: string): Promise<boolean> {
    return false;
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

  private _startAutoSync(): void {
    this._stopAutoSync();

    if (this._options.syncInterval) {
      this._intervalId = setInterval(() => {
        if (!this._isRunning) {
          this.forceSync().catch((error) => {
            logStore.logError('Auto sync failed', error);
          });
        }
      }, this._options.syncInterval);
    }
  }

  private _stopAutoSync(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

// Global stub instance
let syncStub: SyncStub | null = null;

export async function initializeSyncStub(options: SyncStubOptions): Promise<SyncStub> {
  if (syncStub) {
    await syncStub.dispose();
  }

  syncStub = new SyncStub(options);
  await syncStub.initialize();

  return syncStub;
}

export function getSyncStub(): SyncStub | null {
  return syncStub;
}

export async function disposeSyncStub(): Promise<void> {
  if (syncStub) {
    await syncStub.dispose();
    syncStub = null;
  }
}
