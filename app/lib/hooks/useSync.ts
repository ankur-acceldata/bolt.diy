import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useSettings } from './useSettings';
import { workbenchStore } from '~/lib/stores/workbench';
import { getCurrentChatId, getProjectId } from '~/utils/fileLocks';
import { logStore } from '~/lib/stores/logs';
import { initializeFernSync, disposeFernSync, getFernSyncService } from '~/lib/sync/fernSyncService';

// Use Fern API sync service for Golang/Minio integration

// Global initialization state to prevent race conditions
let globalInitializationPromise: Promise<void> | null = null;
let globalIsInitialized = false;
let globalCurrentProjectId = '';
let globalInitializationRef = false;

export function useSync() {
  logStore.logSystem('[FERN-DEBUG] useSync hook instantiated', {
    timestamp: new Date().toISOString(),
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'server-side',
    globalIsInitialized,
    globalCurrentProjectId,
    globalInitializationRef,
  });

  const { syncEnabled, syncAutoSync, syncInterval, syncRemoteUrl } = useSettings();
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null as number | null,
    pendingChanges: 0,
    connected: false,
  });
  const [isInitialized, setIsInitialized] = useState(globalIsInitialized);
  const [currentProjectId, setCurrentProjectId] = useState<string>(globalCurrentProjectId);
  const initializationRef = useRef(globalInitializationRef);

  logStore.logSystem('[FERN-DEBUG] useSync hook settings loaded', {
    syncEnabled,
    syncAutoSync,
    syncInterval,
    syncRemoteUrl,
  });

  // Initialize sync when enabled
  useEffect(() => {
    logStore.logSystem('[FERN-DEBUG] useSync useEffect triggered (syncEnabled dependency)', {
      syncEnabled,
      globalInitializationRef,
      globalIsInitialized,
      globalCurrentProjectId,
      timestamp: new Date().toISOString(),
    });

    if (syncEnabled && !globalInitializationRef) {
      logStore.logSystem('[FERN-DEBUG] Starting sync initialization due to syncEnabled=true');
      globalInitializationRef = true;
      initializationRef.current = true;
      initializeSync();
    } else if (!syncEnabled && globalInitializationRef) {
      logStore.logSystem('[FERN-DEBUG] Disposing sync due to syncEnabled=false');
      globalInitializationRef = false;
      initializationRef.current = false;
      disposeSync();
    } else {
      logStore.logSystem('[FERN-DEBUG] No action taken in useSync useEffect', {
        reason: syncEnabled ? 'already initialized' : 'sync disabled',
      });
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
        let configWsUrl = '/api/ws/fern-fs';

        if (syncRemoteUrl) {
          if (syncRemoteUrl.startsWith('ws://') || syncRemoteUrl.startsWith('wss://')) {
            configWsUrl = syncRemoteUrl;
            configServerUrl =
              syncRemoteUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '') + '/api';
          } else if (syncRemoteUrl.startsWith('/')) {
            // Proxy URL - use as is
            configServerUrl = syncRemoteUrl;
            configWsUrl = syncRemoteUrl.replace('/api/fern-fs', '/api/ws/fern-fs');
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
    const initStart = Date.now();
    logStore.logSystem('[FERN-DEBUG] useSync.initializeSync called', {
      timestamp: new Date().toISOString(),
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'server-side',
      globalIsInitialized,
      globalCurrentProjectId,
      hasGlobalInitPromise: !!globalInitializationPromise,
    });

    // Prevent multiple simultaneous initializations
    if (globalInitializationPromise) {
      logStore.logSystem('[FERN-DEBUG] Sync initialization already in progress, waiting...');
      await globalInitializationPromise;
      setIsInitialized(globalIsInitialized);
      setCurrentProjectId(globalCurrentProjectId);

      const waitDuration = Date.now() - initStart;
      logStore.logSystem('[FERN-DEBUG] Waited for existing initialization', {
        duration: `${waitDuration}ms`,
        finalState: globalIsInitialized,
        projectId: globalCurrentProjectId,
      });

      return;
    }

    globalInitializationPromise = (async () => {
      try {
        // Use centralized project ID manager for consistency
        const chatId = getCurrentChatId();
        const projectId = getProjectId(chatId);

        logStore.logSystem('[FERN-DEBUG] Project ID resolution result', {
          chatId,
          projectId,
          chatIdType: typeof chatId,
          projectIdType: typeof projectId,
        });

        // Only initialize sync if we have a valid project ID
        if (!projectId || projectId === 'default') {
          logStore.logSystem('[FERN-DEBUG] No valid project ID available, skipping sync initialization', {
            projectId,
            chatId,
            reason: !projectId ? 'projectId is null/undefined' : 'projectId is default',
          });
          globalIsInitialized = false;
          setIsInitialized(false);
          globalInitializationPromise = null;

          return;
        }

        globalCurrentProjectId = projectId;
        setCurrentProjectId(projectId);
        logStore.logSystem('[FERN-DEBUG] Sync initialization proceeding', {
          projectId,
          globalCurrentProjectId,
          timestamp: new Date().toISOString(),
        });

        // Use Fern API sync service for Golang/Minio integration
        logStore.logSystem('[FERN-DEBUG] Initializing Fern API sync service...', {
          syncEnabled,
          syncAutoSync,
          syncInterval,
          syncRemoteUrl,
        });

        // Parse remote URL for server and WebSocket URLs
        let serverUrl = '/api/fern-fs';
        let wsUrl = '/api/ws/fern-fs';

        if (syncRemoteUrl) {
          logStore.logSystem('[FERN-DEBUG] Processing custom sync remote URL', { syncRemoteUrl });

          if (syncRemoteUrl.startsWith('ws://') || syncRemoteUrl.startsWith('wss://')) {
            wsUrl = syncRemoteUrl;
            serverUrl =
              syncRemoteUrl.replace('ws://', 'http://').replace('wss://', 'https://').replace('/ws', '') + '/api';
          } else if (syncRemoteUrl.startsWith('/')) {
            // Proxy URL - use as is
            serverUrl = syncRemoteUrl;
            wsUrl = syncRemoteUrl.replace('/api/fern-fs', '/api/ws/fern-fs');
          } else {
            // Add /api to server URL if not present
            serverUrl = syncRemoteUrl.endsWith('/api') ? syncRemoteUrl : syncRemoteUrl + '/api';
            wsUrl = syncRemoteUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/api', '') + '/ws';
          }
        }

        logStore.logSystem('[FERN-DEBUG] Final sync URLs resolved', {
          serverUrl,
          wsUrl,
          originalRemoteUrl: syncRemoteUrl,
        });

        const fernSyncStart = Date.now();
        logStore.logSystem('[FERN-DEBUG] Calling initializeFernSync...');

        const syncIntegration = await initializeFernSync({
          workbenchStore,
          chatId: projectId, // Use the consistent project ID
          serverUrl,
          wsUrl,
          autoSync: syncAutoSync,
          syncInterval,
        });

        const fernSyncDuration = Date.now() - fernSyncStart;
        logStore.logSystem('[FERN-DEBUG] initializeFernSync completed', {
          duration: `${fernSyncDuration}ms`,
          hasSyncIntegration: !!syncIntegration,
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

        globalIsInitialized = true;
        setIsInitialized(true);
        logStore.logSystem('Fern API sync service initialized successfully');

        /*
         * Project will be updated with meaningful name/description when AI generates title
         * No need to update here with generic names since AI will provide better ones
         */
        logStore.logSystem('Sync initialized - project will be updated when AI generates meaningful title');

        // Removed toast - using status indicator instead
      } catch (error) {
        logStore.logError('Failed to initialize sync', error);
        toast.error(`Failed to initialize sync: ${(error as Error).message}`);
        globalIsInitialized = false;
        setIsInitialized(false);
      } finally {
        globalInitializationPromise = null;
      }
    })();

    await globalInitializationPromise;
  };

  const disposeSync = async () => {
    try {
      await disposeFernSync();
      globalIsInitialized = false;
      globalCurrentProjectId = '';
      globalInitializationRef = false;
      setIsInitialized(false);
      setCurrentProjectId('');
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

  // Method to update sync service with real chatId when it becomes available
  const updateSyncChatId = useCallback(
    async (newChatId: string) => {
      logStore.logSystem('[FERN-DEBUG] updateSyncChatId called', {
        newChatId,
        syncEnabled,
        globalIsInitialized,
        timestamp: new Date().toISOString(),
      });

      if (!newChatId || newChatId === 'default') {
        logStore.logSystem('[FERN-DEBUG] updateSyncChatId rejected - invalid chatId', { newChatId });
        return;
      }

      try {
        globalCurrentProjectId = newChatId;
        setCurrentProjectId(newChatId);

        const fernSync = getFernSyncService();
        logStore.logSystem('[FERN-DEBUG] updateSyncChatId - fernSync service check', {
          hasFernSync: !!fernSync,
          syncEnabled,
          globalIsInitialized,
        });

        if (fernSync) {
          // Update the Fern sync service with the new chat ID
          logStore.logSystem('[FERN-DEBUG] Updating existing sync service with real chatId', { newChatId });
          await fernSync.updateChatId(newChatId);
        } else if (syncEnabled && !globalIsInitialized) {
          // If sync is enabled but not initialized (due to missing projectId), initialize now
          logStore.logSystem('[FERN-DEBUG] Valid chatId now available, initializing sync service...', {
            newChatId,
            syncEnabled,
            globalIsInitialized,
          });
          await initializeSync();
        } else {
          logStore.logSystem('[FERN-DEBUG] No action taken in updateSyncChatId', {
            reason: !syncEnabled ? 'sync disabled' : 'already initialized',
            syncEnabled,
            globalIsInitialized,
          });
        }
      } catch (error) {
        logStore.logError('Failed to update sync service with new chatId:', error);
      }
    },
    [syncEnabled],
  );

  return {
    isInitialized,
    syncStatus,
    currentProjectId,
    forceSync,
    getSyncStatus,
    disposeSync,
    updateSyncChatId, // Expose method to update chatId
  };
}
