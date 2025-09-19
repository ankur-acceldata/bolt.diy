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
  logStore.logSystem('[FERN] useSync hook instantiated', {
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

  logStore.logSystem('[FERN] useSync hook settings loaded', {
    syncEnabled,
    syncAutoSync,
    syncInterval,
    syncRemoteUrl,
  });

  // Unified starter for sync init with concise failure reasons
  const startSyncIfReady = useCallback(
    async (source: string, providedProjectId?: string) => {
      const chatId = getCurrentChatId();
      const projectIdCandidate = providedProjectId || globalCurrentProjectId || getProjectId(chatId);

      const reasons: string[] = [];

      if (!syncEnabled) {
        reasons.push('sync_disabled');
      }

      if (!projectIdCandidate || projectIdCandidate === 'default') {
        reasons.push('invalid_project_id');
      }

      if (globalInitializationPromise) {
        reasons.push('init_in_progress');
      }

      if (globalIsInitialized) {
        reasons.push('already_initialized');
      }

      if (reasons.length > 0) {
        logStore.logSystem('[FERN] Not starting sync', {
          source,
          reasons,
          syncEnabled,
          projectIdCandidate,
          globalIsInitialized,
          hasInitPromise: !!globalInitializationPromise,
        });
        return false;
      }

      globalInitializationRef = true;
      initializationRef.current = true;
      globalCurrentProjectId = projectIdCandidate;
      setCurrentProjectId(projectIdCandidate);

      logStore.logSystem('[FERN] Starting sync initialization', {
        source,
        projectId: projectIdCandidate,
      });

      await initializeSync();

      return true;
    },
    [syncEnabled],
  );

  // Initialize sync when enabled
  useEffect(() => {
    logStore.logSystem('[FERN] useSync useEffect triggered (syncEnabled dependency)', {
      syncEnabled,
      globalInitializationRef,
      globalIsInitialized,
      globalCurrentProjectId,
      timestamp: new Date().toISOString(),
    });

    if (syncEnabled && !globalInitializationRef) {
      startSyncIfReady('syncEnabled_effect');
    } else if (!syncEnabled && globalInitializationRef) {
      logStore.logSystem('[FERN] Disposing sync due to syncEnabled=false');
      globalInitializationRef = false;
      initializationRef.current = false;
      disposeSync();
    } else {
      logStore.logSystem('[FERN] No action taken in useSync useEffect', {
        reason: syncEnabled ? 'already initialized' : 'sync disabled',
      });
    }
  }, [syncEnabled, startSyncIfReady]);

  // Monitor project ID from fileLocks - this is the source of truth
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const checkProjectId = () => {
      try {
        const chatId = getCurrentChatId();
        const projectIdFromFileLocks = getProjectId(chatId);

        logStore.logSystem('[FERN] Project ID monitoring check', {
          chatId,
          projectIdFromFileLocks,
          currentProjectId,
          globalCurrentProjectId,
          timestamp: new Date().toISOString(),
        });

        // Update if we found a valid project ID and it's different from current
        if (
          projectIdFromFileLocks &&
          projectIdFromFileLocks !== 'default' &&
          projectIdFromFileLocks !== currentProjectId
        ) {
          logStore.logSystem('[FERN] Project ID updated from fileLocks', {
            oldProjectId: currentProjectId,
            newProjectId: projectIdFromFileLocks,
            source: 'fileLocks monitoring',
          });

          // Update both local and global state
          globalCurrentProjectId = projectIdFromFileLocks;
          setCurrentProjectId(projectIdFromFileLocks);

          // If sync is enabled and not already initialized, try to initialize now
          if (syncEnabled && !globalIsInitialized && !globalInitializationRef) {
            startSyncIfReady('projectId_monitor', projectIdFromFileLocks);
          }
        }
      } catch (error) {
        logStore.logError('[FERN] Error in project ID monitoring', error);
      }
    };

    // Check immediately
    checkProjectId();

    /*
     * Set up polling with faster initial polling for project creation scenarios
     * More frequent checks initially when no project ID, then less frequent
     */
    const pollInterval = currentProjectId && currentProjectId !== 'default' ? 5000 : 100; // Reduced from 500ms to 100ms
    intervalId = setInterval(checkProjectId, pollInterval);

    logStore.logSystem('[FERN] Project ID monitoring started', {
      pollInterval,
      currentProjectId,
    });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        logStore.logSystem('[FERN] Project ID monitoring stopped');
      }
    };
  }, [currentProjectId, syncEnabled, globalIsInitialized, globalInitializationRef, startSyncIfReady]);

  // Listen for project creation events to trigger immediate sync
  // eslint-disable-next-line consistent-return
  useEffect(() => {
    const handleProjectCreated = (event: CustomEvent) => {
      const { projectId, chatId } = event.detail;
      logStore.logSystem('[FERN] Received project-created event', {
        projectId,
        chatId,
        currentProjectId,
        syncEnabled,
      });

      // Trigger immediate sync check
      if (syncEnabled && (!currentProjectId || currentProjectId === 'default')) {
        logStore.logSystem('[FERN] Triggering immediate sync from project-created event');

        // Use setTimeout to ensure the event is fully processed
        setTimeout(() => {
          try {
            const projectIdFromFileLocks = getProjectId(chatId);

            if (projectIdFromFileLocks && projectIdFromFileLocks !== 'default') {
              globalCurrentProjectId = projectIdFromFileLocks;
              setCurrentProjectId(projectIdFromFileLocks);

              // Initialize sync if not already initialized
              if (!globalIsInitialized && !globalInitializationRef) {
                startSyncIfReady('project_created_event', projectIdFromFileLocks);
              }
            }
          } catch (error) {
            logStore.logError('[FERN] Error handling project-created event', error);
          }
        }, 20); // Small delay to ensure fileLocks is updated
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('project-created', handleProjectCreated as EventListener);

      return () => {
        window.removeEventListener('project-created', handleProjectCreated as EventListener);
      };
    }
  }, [syncEnabled, currentProjectId, startSyncIfReady]);

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
    if (!syncEnabled) {
      return undefined;
    }

    const updateStatus = () => {
      const fernSync = getFernSyncService();

      if (fernSync) {
        setSyncStatus(fernSync.getSyncStatus());
      }
    };

    updateStatus();

    const interval = setInterval(updateStatus, 5000);

    // Update every 5 seconds
    return () => clearInterval(interval);
  }, [syncEnabled]);

  const initializeSync = async () => {
    const initStart = Date.now();
    logStore.logSystem('[FERN] useSync.initializeSync called', {
      timestamp: new Date().toISOString(),
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'server-side',
      globalIsInitialized,
      globalCurrentProjectId,
      hasGlobalInitPromise: !!globalInitializationPromise,
    });

    // Prevent multiple simultaneous initializations
    if (globalInitializationPromise) {
      logStore.logSystem('[FERN] Sync initialization already in progress, waiting...');
      await globalInitializationPromise;
      setIsInitialized(globalIsInitialized);
      setCurrentProjectId(globalCurrentProjectId);

      const waitDuration = Date.now() - initStart;
      logStore.logSystem('[FERN] Waited for existing initialization', {
        duration: `${waitDuration}ms`,
        finalState: globalIsInitialized,
        projectId: globalCurrentProjectId,
      });

      return;
    }

    globalInitializationPromise = (async () => {
      try {
        // Use the project ID from monitoring effect (source of truth from fileLocks)
        const chatId = getCurrentChatId();
        const projectId = globalCurrentProjectId || getProjectId(chatId);

        logStore.logSystem('[FERN] Project ID resolution result', {
          chatId,
          projectId,
          globalCurrentProjectId,
          chatIdType: typeof chatId,
          projectIdType: typeof projectId,
          source: globalCurrentProjectId ? 'monitoring effect' : 'fallback to fileLocks',
        });

        // Only initialize sync if we have a valid project ID
        if (!projectId || projectId === 'default') {
          logStore.logSystem('[FERN] No valid project ID available, skipping sync initialization', {
            projectId,
            chatId,
            reason: !projectId ? 'projectId is null/undefined' : 'projectId is default',
          });
          globalIsInitialized = false;
          globalInitializationRef = false; // Reset to allow retry when project ID becomes available
          initializationRef.current = false; // Reset local ref too
          setIsInitialized(false);
          globalInitializationPromise = null;

          return;
        }

        logStore.logSystem(`Checking project ID: ${projectId} for chat: ${chatId}`);

        // Only initialize sync if we have a valid project ID
        if (!projectId || projectId === 'default') {
          logStore.logSystem('No valid project ID available, skipping sync initialization until chatId is available');
          globalIsInitialized = false;
          setIsInitialized(false);
          globalInitializationPromise = null;

          return;
        }

        globalCurrentProjectId = projectId;
        setCurrentProjectId(projectId);
        logStore.logSystem(`Initializing sync with project ID: ${projectId}`);

        // Use Fern API sync service for Golang/Minio integration
        logStore.logSystem('[FERN] Initializing Fern API sync service...', {
          syncEnabled,
          syncAutoSync,
          syncInterval,
          syncRemoteUrl,
        });

        // Parse remote URL for server and WebSocket URLs
        let serverUrl = '/api/fern-fs';
        let wsUrl = '/api/ws/fern-fs';

        if (syncRemoteUrl) {
          logStore.logSystem('[FERN] Processing custom sync remote URL', { syncRemoteUrl });

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

        logStore.logSystem('[FERN] Final sync URLs resolved', {
          serverUrl,
          wsUrl,
          originalRemoteUrl: syncRemoteUrl,
        });

        const fernSyncStart = Date.now();
        logStore.logSystem('[FERN] Calling initializeFernSync...');

        const syncIntegration = await initializeFernSync({
          workbenchStore,
          chatId: projectId, // Use the consistent project ID
          serverUrl,
          wsUrl,
          autoSync: syncAutoSync,
          syncInterval,
        });

        const fernSyncDuration = Date.now() - fernSyncStart;
        logStore.logSystem('[FERN] initializeFernSync completed', {
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
        logStore.logError('[FERN] Failed to initialize sync', error);
        toast.error(`Failed to initialize sync: ${(error as Error).message}`);
        globalIsInitialized = false;
        globalInitializationRef = false; // Reset to allow retry
        initializationRef.current = false; // Reset local ref
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
      globalInitializationRef = false;
      setIsInitialized(false);

      /*
       * Keep project ID available from fileLocks even when sync is disposed
       * This ensures adhoc runs still work when sync is disabled
       */
      const chatId = getCurrentChatId();
      const projectIdFromFileLocks = getProjectId(chatId);

      if (projectIdFromFileLocks && projectIdFromFileLocks !== 'default') {
        globalCurrentProjectId = projectIdFromFileLocks;
        setCurrentProjectId(projectIdFromFileLocks);
        logStore.logSystem('[FERN-DEBUG] Keeping project ID available after sync disposal', {
          projectId: projectIdFromFileLocks,
          reason: 'for adhoc runs when sync disabled',
        });
      } else {
        globalCurrentProjectId = '';
        setCurrentProjectId('');
      }

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
        /*
         * Immediate project ID check with retry mechanism
         * This fixes the race condition where setProjectId() happens just before this call
         */
        let projectIdFromFileLocks = getProjectId(newChatId);
        let retryCount = 0;
        const maxRetries = 5;

        // Retry mechanism: if no project ID found, wait briefly and try again
        while ((!projectIdFromFileLocks || projectIdFromFileLocks === 'default') && retryCount < maxRetries) {
          logStore.logSystem('[FERN-DEBUG] Project ID not found, retrying...', {
            newChatId,
            retryCount,
            maxRetries,
          });

          await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay
          projectIdFromFileLocks = getProjectId(newChatId);
          retryCount++;
        }

        logStore.logSystem('[FERN-DEBUG] updateSyncChatId - final project ID check', {
          newChatId,
          projectIdFromFileLocks,
          retryCount,
          source: 'updateSyncChatId with retry',
        });

        // Only update if we have a valid project ID from fileLocks
        if (projectIdFromFileLocks && projectIdFromFileLocks !== 'default') {
          globalCurrentProjectId = projectIdFromFileLocks;
          setCurrentProjectId(projectIdFromFileLocks);

          logStore.logSystem('[FERN-DEBUG] Project ID successfully updated', {
            newProjectId: projectIdFromFileLocks,
            source: 'updateSyncChatId immediate check',
          });
        } else {
          // Fallback: trust the provided newChatId if it's not default
          if (newChatId && newChatId !== 'default') {
            globalCurrentProjectId = newChatId;
            setCurrentProjectId(newChatId);
            logStore.logSystem('[FERN-DEBUG] Using newChatId as project ID fallback', {
              newChatId,
              retryCount,
            });
          } else {
            logStore.logSystem('[FERN-DEBUG] No valid project ID in fileLocks after retries and newChatId invalid', {
              newChatId,
              retryCount,
              finalProjectId: projectIdFromFileLocks,
            });
            return;
          }
        }

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
            globalInitializationRef,
          });

          // Use unified starter to avoid duplicate inits
          await startSyncIfReady('updateSyncChatId', newChatId);
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

  // Function to trigger immediate project ID check and sync initialization
  const triggerImmediateSync = useCallback(
    async (chatId?: string) => {
      try {
        const targetChatId = chatId || getCurrentChatId();
        logStore.logSystem('[FERN-DEBUG] triggerImmediateSync called', {
          targetChatId,
          syncEnabled,
          globalIsInitialized,
        });

        // Force immediate project ID check
        const projectIdFromFileLocks = getProjectId(targetChatId);

        if (projectIdFromFileLocks && projectIdFromFileLocks !== 'default') {
          globalCurrentProjectId = projectIdFromFileLocks;
          setCurrentProjectId(projectIdFromFileLocks);

          logStore.logSystem('[FERN-DEBUG] Immediate sync trigger - project ID found', {
            projectId: projectIdFromFileLocks,
            chatId: targetChatId,
          });

          // Initialize sync if enabled and not already initialized
          if (syncEnabled && !globalIsInitialized && !globalInitializationRef) {
            logStore.logSystem('[FERN-DEBUG] Triggering immediate sync initialization');
            globalInitializationRef = true;
            initializationRef.current = true;

            await initializeSync();
          }
        } else {
          logStore.logSystem('[FERN-DEBUG] Immediate sync trigger - no project ID found', {
            projectId: projectIdFromFileLocks,
            chatId: targetChatId,
          });
        }
      } catch (error) {
        logStore.logError('[FERN-DEBUG] Error in triggerImmediateSync', error);
      }
    },
    [syncEnabled],
  );

  return {
    isInitialized: isInitialized || !!getFernSyncService(),
    syncStatus,
    currentProjectId,
    forceSync,
    getSyncStatus,
    disposeSync,
    updateSyncChatId, // Expose method to update chatId
    triggerImmediateSync, // Expose method to trigger immediate sync
  };
}
