import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useSettings } from './useSettings';
import { workbenchStore } from '~/lib/stores/workbench';
import { getCurrentChatId } from '~/utils/fileLocks';
import { logStore } from '~/lib/stores/logs';
import { initializeFernSync, disposeFernSync, getFernSyncService } from '~/lib/sync/fernSyncService';

// Use Fern API sync service for Golang/Minio integration

export function useSync() {
  const { syncEnabled, syncAutoSync, syncInterval, syncRemoteUrl } = useSettings();
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null as number | null,
    pendingChanges: 0,
    connected: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationRef = useRef(false);

  // Initialize sync when enabled
  useEffect(() => {
    if (syncEnabled && !initializationRef.current) {
      initializationRef.current = true;
      initializeSync();
    } else if (!syncEnabled && initializationRef.current) {
      initializationRef.current = false;
      disposeSync();
    }
  }, [syncEnabled]);

  // Update sync configuration when settings change
  useEffect(() => {
    const updateSyncConfig = () => {
      const fernSync = getFernSyncService();

      if (fernSync && isInitialized) {
        fernSync.setAutoSync(syncAutoSync);

        // Parse URLs properly for config update
        let configServerUrl = '/api/fern-fs';
        let configWsUrl = '/ws/fern-fs';

        if (syncRemoteUrl) {
          if (syncRemoteUrl.startsWith('ws://') || syncRemoteUrl.startsWith('wss://')) {
            configWsUrl = syncRemoteUrl;
            configServerUrl =
              syncRemoteUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '') + '/api';
          } else if (syncRemoteUrl.startsWith('/')) {
            // Proxy URL - use as is
            configServerUrl = syncRemoteUrl;
            configWsUrl = syncRemoteUrl.replace('/api/fern-fs', '/ws/fern-fs');
          } else {
            // Add /api to server URL if not present
            configServerUrl = syncRemoteUrl.endsWith('/api') ? syncRemoteUrl : syncRemoteUrl + '/api';
            configWsUrl =
              syncRemoteUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '') + '/ws';
          }
        }

        fernSync.updateConfig({
          syncInterval,
          serverUrl: configServerUrl,
          wsUrl: configWsUrl,
        });
        logStore.logSystem(`Sync configuration updated: autoSync=${syncAutoSync}, interval=${syncInterval}ms`);
      }
    };

    updateSyncConfig();
  }, [syncAutoSync, syncInterval, syncRemoteUrl, isInitialized]);

  // Update sync status periodically
  useEffect(() => {
    if (!syncEnabled || !isInitialized) {
      return undefined;
    }

    const updateStatus = () => {
      const fernSync = getFernSyncService();

      if (fernSync) {
        setSyncStatus(fernSync.getSyncStatus());
      }
    };

    updateStatus();

    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [syncEnabled, isInitialized]);

  const initializeSync = async () => {
    try {
      // Try to get chatId, but don't require it for global sync
      let chatId = getCurrentChatId();

      // Generate a new project ID if none exists
      if (!chatId || chatId === 'default') {
        chatId = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logStore.logSystem(`Generated new project ID: ${chatId}`);
      }

      // Use Fern API sync service for Golang/Minio integration
      logStore.logSystem('Initializing Fern API sync service...');

      // Parse remote URL for server and WebSocket URLs
      let serverUrl = '/api/fern-fs';
      let wsUrl = '/ws/fern-fs';

      if (syncRemoteUrl) {
        if (syncRemoteUrl.startsWith('ws://') || syncRemoteUrl.startsWith('wss://')) {
          wsUrl = syncRemoteUrl;
          serverUrl =
            syncRemoteUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '') + '/api';
        } else if (syncRemoteUrl.startsWith('/')) {
          // Proxy URL - use as is
          serverUrl = syncRemoteUrl;
          wsUrl = syncRemoteUrl.replace('/api/fern-fs', '/ws/fern-fs');
        } else {
          // Add /api to server URL if not present
          serverUrl = syncRemoteUrl.endsWith('/api') ? syncRemoteUrl : syncRemoteUrl + '/api';
          wsUrl = syncRemoteUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '') + '/ws';
        }
      }

      const syncIntegration = await initializeFernSync({
        workbenchStore,
        chatId,
        serverUrl,
        wsUrl,
        autoSync: syncAutoSync,
        syncInterval,
      });

      // Set up event listeners for Fern sync service
      syncIntegration.on('sync-started', () => {
        logStore.logSystem('Sync started');
        setSyncStatus((prev) => ({ ...prev, isRunning: true }));
      });

      syncIntegration.on('sync-completed', (data: any) => {
        logStore.logSystem(`Sync completed: ${data.changesApplied || 0} changes applied`);
        setSyncStatus((prev) => ({
          ...prev,
          isRunning: false,
          lastSync: Date.now(),
          pendingChanges: 0,
        }));

        // Removed toast - using status indicator instead
      });

      syncIntegration.on('sync-error', (error: any) => {
        logStore.logError('Sync error', error);
        setSyncStatus((prev) => ({ ...prev, isRunning: false }));

        // Only show critical errors
        if (error.message.includes('server not available') || error.message.includes('connection failed')) {
          toast.error(`Sync error: ${error.message}`);
        }
      });

      syncIntegration.on('connection-changed', (connected: boolean) => {
        setSyncStatus((prev) => ({ ...prev, connected }));
        logStore.logSystem(`Sync connection ${connected ? 'established' : 'lost'}`);

        // Removed toast - using status indicator instead
      });

      syncIntegration.on('file-saved', (data: any) => {
        logStore.logSystem(`Auto-saved file: ${data.path}`);

        // Subtle notification for auto-save is already handled in the service
      });

      syncIntegration.on('auto-save-error', (data: any) => {
        logStore.logError(`Auto-save failed for ${data.path}`, data.error);

        // Removed toast - using status indicator instead
      });

      syncIntegration.on('remote-change', (data: any) => {
        logStore.logSystem(`Remote file change: ${data.operation} on ${data.path}`);

        // Removed toast - using status indicator instead
      });

      setIsInitialized(true);
      logStore.logSystem('Fern API sync service initialized successfully');

      // Removed toast - using status indicator instead
    } catch (error) {
      logStore.logError('Failed to initialize sync', error);
      toast.error(`Failed to initialize sync: ${(error as Error).message}`);
      setIsInitialized(false);
    }
  };

  const disposeSync = async () => {
    try {
      await disposeFernSync();
      setIsInitialized(false);
      setSyncStatus({
        isRunning: false,
        lastSync: null,
        pendingChanges: 0,
        connected: false,
      });
      logStore.logSystem('Fern sync service disposed');

      // Removed toast - using status indicator instead
    } catch (error) {
      logStore.logError('Failed to dispose sync', error);
      toast.error(`Failed to disable sync: ${(error as Error).message}`);
    }
  };

  const forceSync = async () => {
    const syncIntegration = getFernSyncService();

    if (!syncIntegration) {
      toast.error('Sync not initialized');
      return;
    }

    try {
      setSyncStatus((prev) => ({ ...prev, isRunning: true }));

      const result = await syncIntegration.forceSync();

      if (result.success) {
        logStore.logSystem('Manual sync completed successfully');

        // Removed toast - using status indicator instead
      } else {
        logStore.logError('Manual sync completed with errors', result.errors);

        // Show critical errors only
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Sync completed with some errors. Check logs for details.`);
        }
      }
    } catch (error) {
      logStore.logError('Manual sync failed', error);
      toast.error(`Manual sync failed: ${(error as Error).message}`);
      setSyncStatus((prev) => ({ ...prev, isRunning: false }));
    }
  };

  const getSyncStatus = () => {
    const fernSync = getFernSyncService();
    return fernSync ? fernSync.getSyncStatus() : syncStatus;
  };

  return {
    isInitialized,
    syncStatus,
    forceSync,
    getSyncStatus,
    disposeSync,
  };
}
