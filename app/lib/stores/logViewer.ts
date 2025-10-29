import { atom, type WritableAtom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import type { LogViewerInstance, CreateLogViewerInstanceConfig } from '~/types/logStream';
import { getProjectId } from '~/utils/fileLocks';

const logger = createScopedLogger('LogViewerStore');

const MAX_LOG_VIEWERS = 5;
const STORAGE_KEY_PREFIX = 'bolt_log_viewer_state';

interface PersistedLogViewerState {
  showLogViewerPanel: boolean;
  logViewerInstances: LogViewerInstance[];
  activeLogViewerId: string | null;
  autoSendEnabled: boolean;
}

export class LogViewerStore {
  showLogViewerPanel: WritableAtom<boolean>;
  logViewerInstances: WritableAtom<LogViewerInstance[]>;
  activeLogViewerId: WritableAtom<string | null>;
  autoSendEnabled: WritableAtom<boolean>;

  constructor() {
    // Load persisted state from localStorage
    const persistedState = this._loadPersistedState();

    // Initialize atoms with persisted state or defaults
    this.showLogViewerPanel = import.meta.hot?.data.showLogViewerPanel ?? atom(persistedState.showLogViewerPanel);
    this.logViewerInstances = import.meta.hot?.data.logViewerInstances ?? atom(persistedState.logViewerInstances);
    this.activeLogViewerId = import.meta.hot?.data.activeLogViewerId ?? atom(persistedState.activeLogViewerId);
    this.autoSendEnabled = import.meta.hot?.data.autoSendEnabled ?? atom(persistedState.autoSendEnabled);

    if (import.meta.hot) {
      import.meta.hot.data.showLogViewerPanel = this.showLogViewerPanel;
      import.meta.hot.data.logViewerInstances = this.logViewerInstances;
      import.meta.hot.data.activeLogViewerId = this.activeLogViewerId;
      import.meta.hot.data.autoSendEnabled = this.autoSendEnabled;
    }

    // Subscribe to changes and persist to localStorage
    this.showLogViewerPanel.subscribe(() => this._persistState());
    this.logViewerInstances.subscribe(() => this._persistState());
    this.activeLogViewerId.subscribe(() => this._persistState());
    this.autoSendEnabled.subscribe(() => this._persistState());

    logger.info('LogViewerStore initialized with persisted state:', persistedState);
  }

  /**
   * Get storage key scoped to current project ID
   */
  private _getStorageKey(): string {
    const projectId = getProjectId();
    return `${STORAGE_KEY_PREFIX}_${projectId}`;
  }

  /**
   * Load persisted state from localStorage for current project
   */
  private _loadPersistedState(): PersistedLogViewerState {
    try {
      const storageKey = this._getStorageKey();
      const stored = localStorage.getItem(storageKey);

      if (stored) {
        const parsed = JSON.parse(stored) as PersistedLogViewerState;
        const projectId = getProjectId();
        logger.info(`Loaded persisted log viewer state for project ${projectId}`);

        return parsed;
      }
    } catch (error) {
      logger.error('Failed to load persisted log viewer state:', error);
    }

    // Return default state
    return {
      showLogViewerPanel: false,
      logViewerInstances: [],
      activeLogViewerId: null,
      autoSendEnabled: false,
    };
  }

  /**
   * Persist current state to localStorage for current project
   */
  private _persistState(): void {
    try {
      const storageKey = this._getStorageKey();
      const state: PersistedLogViewerState = {
        showLogViewerPanel: this.showLogViewerPanel.get(),
        logViewerInstances: this.logViewerInstances.get(),
        activeLogViewerId: this.activeLogViewerId.get(),
        autoSendEnabled: this.autoSendEnabled.get(),
      };

      localStorage.setItem(storageKey, JSON.stringify(state));

      const projectId = getProjectId();
      logger.debug(`Persisted log viewer state for project ${projectId}`);
    } catch (error) {
      logger.error('Failed to persist log viewer state:', error);
    }
  }

  /**
   * Clear persisted state from localStorage for current project
   */
  clearPersistedState(): void {
    try {
      const storageKey = this._getStorageKey();
      localStorage.removeItem(storageKey);

      const projectId = getProjectId();
      logger.info(`Cleared persisted log viewer state for project ${projectId}`);
    } catch (error) {
      logger.error('Failed to clear persisted log viewer state:', error);
    }
  }

  /**
   * Clear persisted state for all projects
   */
  clearAllPersistedStates(): void {
    try {
      const keys = Object.keys(localStorage);
      const logViewerKeys = keys.filter((key) => key.startsWith(STORAGE_KEY_PREFIX));

      logViewerKeys.forEach((key) => {
        localStorage.removeItem(key);
      });

      logger.info(`Cleared persisted log viewer state for ${logViewerKeys.length} projects`);
    } catch (error) {
      logger.error('Failed to clear all persisted log viewer states:', error);
    }
  }

  /**
   * Toggle the log viewer panel visibility
   */
  toggleLogViewerPanel(value?: boolean) {
    const newValue = value !== undefined ? value : !this.showLogViewerPanel.get();
    this.showLogViewerPanel.set(newValue);
    logger.debug('Log viewer panel toggled:', newValue);
  }

  /**
   * Create a new log viewer instance
   */
  createLogViewerInstance(config: CreateLogViewerInstanceConfig): string {
    const instances = this.logViewerInstances.get();

    // Check if we've reached the maximum number of log viewers
    if (instances.length >= MAX_LOG_VIEWERS) {
      logger.warn(`Maximum number of log viewers (${MAX_LOG_VIEWERS}) reached. Removing oldest instance.`);
      this.closeLogViewerInstance(instances[0].id);
    }

    // Generate unique ID
    const id = `log-viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine title
    const title =
      config.title || `${config.isPipeline ? 'Pipeline' : 'Adhoc Run'} - ${config.runId.substring(0, 8)}...`;

    const newInstance: LogViewerInstance = {
      id,
      dataplaneId: config.dataplaneId,
      runId: config.runId,
      isPipeline: config.isPipeline,
      title,
      timestamp: Date.now(),
    };

    // Add new instance
    this.logViewerInstances.set([...instances, newInstance]);

    // Set as active
    this.activeLogViewerId.set(id);

    // Show the panel
    this.showLogViewerPanel.set(true);

    logger.info('Created new log viewer instance:', newInstance);

    return id;
  }

  /**
   * Close a specific log viewer instance
   */
  closeLogViewerInstance(id: string) {
    const instances = this.logViewerInstances.get();
    const updatedInstances = instances.filter((instance) => instance.id !== id);

    this.logViewerInstances.set(updatedInstances);

    // If we closed the active instance, switch to another one
    if (this.activeLogViewerId.get() === id) {
      if (updatedInstances.length > 0) {
        // Switch to the last instance
        this.activeLogViewerId.set(updatedInstances[updatedInstances.length - 1].id);
      } else {
        // No more instances, hide the panel
        this.activeLogViewerId.set(null);
        this.showLogViewerPanel.set(false);
      }
    }

    logger.info('Closed log viewer instance:', id);
  }

  /**
   * Set the active log viewer instance
   */
  setActiveLogViewerInstance(id: string) {
    const instances = this.logViewerInstances.get();
    const instance = instances.find((inst) => inst.id === id);

    if (instance) {
      this.activeLogViewerId.set(id);
      logger.debug('Set active log viewer instance:', id);
    } else {
      logger.warn('Attempted to set active log viewer instance that does not exist:', id);
    }
  }

  /**
   * Get a specific log viewer instance
   */
  getLogViewerInstance(id: string): LogViewerInstance | undefined {
    const instances = this.logViewerInstances.get();
    return instances.find((instance) => instance.id === id);
  }

  /**
   * Close all log viewer instances
   */
  closeAllLogViewerInstances() {
    this.logViewerInstances.set([]);
    this.activeLogViewerId.set(null);
    this.showLogViewerPanel.set(false);
    logger.info('Closed all log viewer instances');
  }

  /**
   * Toggle auto-send mode for all log viewers
   */
  toggleAutoSend() {
    const currentValue = this.autoSendEnabled.get();
    this.autoSendEnabled.set(!currentValue);
    logger.info('Auto-send toggled:', !currentValue);
  }

  /**
   * Set auto-send mode
   */
  setAutoSend(enabled: boolean) {
    this.autoSendEnabled.set(enabled);
    logger.info('Auto-send set to:', enabled);
  }
}

export const logViewerStore = new LogViewerStore();
