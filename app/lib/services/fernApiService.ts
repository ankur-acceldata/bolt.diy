/**
 * Service for communicating with the Fern-FS Golang API backend
 * Handles file operations and sync through the Golang server with Minio storage
 */

import { logStore } from '~/lib/stores/logs';
import { getBasePath } from '~/lib/config';

export interface FernFile {
  path: string;
  content: string;
  size: number;
  lastModified: number;
  checksum?: string;
}

export interface FernFileManifest {
  files: FernFile[];
  totalFiles: number;
  lastUpdated: number;
}

export interface SyncResult {
  success: boolean;
  filesUpdated: number;
  filesDeleted: number;
  errors?: string[];
}

export class FernApiService {
  private _baseUrl: string;
  private _wsUrl: string;
  private _websocket: WebSocket | null = null;
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _reconnectDelay = 1000;
  private _projectId: string | null = null;

  constructor(baseUrl = '/api/fern-fs', wsUrl = '/ws/fern-fs') {
    this._baseUrl = baseUrl;
    this._wsUrl = wsUrl;
  }

  /**
   * Set the project ID for all API calls
   */
  setProjectId(projectId: string): void {
    this._projectId = projectId;
  }

  /**
   * Get the current project ID
   */
  getProjectId(): string | null {
    return this._projectId;
  }

  /**
   * Check if the Golang API server is available
   */
  async isServerAvailable(): Promise<boolean> {
    try {
      console.log('Checking server availability at:', `${this._baseUrl}/health`);

      // Create a promise that resolves with the fetch result
      const fetchPromise = fetch(`${this._baseUrl}/health`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'same-origin',
      });

      // Create a timeout promise
      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000);
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      console.log('Server health check response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Server health data:', data);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Server availability check failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      logStore.logError('Fern API server not available', error);

      return false;
    }
  }

  /**
   * Get all files from the server
   */
  async getFiles(): Promise<FernFile[]> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/files`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get files: ${response.statusText}`);
      }

      const data = (await response.json()) as { files?: FernFile[] };

      return data.files || [];
    } catch (error) {
      logStore.logError('Failed to get files from Fern API', error);
      throw error;
    }
  }

  /**
   * Get a specific file content
   */
  async getFile(path: string): Promise<FernFile | null> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/files/${encodeURIComponent(path)}`, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get file: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError(`Failed to get file ${path} from Fern API`, error);
      throw error;
    }
  }

  /**
   * Create or update a file
   */
  async saveFile(path: string, content: string): Promise<void> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/files/${encodeURIComponent(path)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content,
          path,
          projectId: this._projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save file: ${response.statusText}`);
      }

      logStore.logSystem(`File saved to Fern API: ${path}`);
    } catch (error) {
      logStore.logError(`Failed to save file ${path} to Fern API`, error);
      throw error;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/files/${encodeURIComponent(path)}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to delete file: ${response.statusText}`);
      }

      logStore.logSystem(`File deleted from Fern API: ${path}`);
    } catch (error) {
      logStore.logError(`Failed to delete file ${path} from Fern API`, error);
      throw error;
    }
  }

  /**
   * Move/rename a file
   */
  async moveFile(oldPath: string, newPath: string): Promise<void> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/files/move`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          oldPath,
          newPath,
          projectId: this._projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to move file: ${response.statusText}`);
      }

      logStore.logSystem(`File moved in Fern API: ${oldPath} -> ${newPath}`);
    } catch (error) {
      logStore.logError(`Failed to move file ${oldPath} to ${newPath} in Fern API`, error);
      throw error;
    }
  }

  /**
   * Get file manifest for sync comparison
   */
  async getManifest(): Promise<FernFileManifest> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (this._projectId) {
        headers['X-Project-ID'] = this._projectId;
      }

      const response = await fetch(`${this._baseUrl}/sync/manifest`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get manifest: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logStore.logError('Failed to get manifest from Fern API', error);
      throw error;
    }
  }

  /**
   * Sync local files with the server
   */
  async syncFiles(localFiles: { [path: string]: { content: string; lastModified?: number } }): Promise<SyncResult> {
    try {
      // Get server manifest to compare
      const manifest = await this.getManifest();
      const serverFiles = new Map(manifest.files.map((f) => [f.path, f]));

      let filesUpdated = 0;
      const filesDeleted = 0;
      const errors: string[] = [];

      // Upload/update files that are newer locally or don't exist on server
      for (const [path, localFile] of Object.entries(localFiles)) {
        try {
          const serverFile = serverFiles.get(path);
          const localModified = localFile.lastModified || Date.now();

          if (!serverFile || !serverFile.lastModified || localModified > serverFile.lastModified) {
            await this.saveFile(path, localFile.content);
            filesUpdated++;
          }
        } catch (error) {
          errors.push(`Failed to sync file ${path}: ${(error as Error).message}`);
        }
      }

      /*
       * Note: We don't auto-delete files that exist on server but not locally
       * This is a safety measure to prevent accidental data loss
       */

      logStore.logSystem(`Sync completed: ${filesUpdated} files updated, ${filesDeleted} files deleted`);

      return {
        success: errors.length === 0,
        filesUpdated,
        filesDeleted,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logStore.logError('Failed to sync files with Fern API', error);
      return {
        success: false,
        filesUpdated: 0,
        filesDeleted: 0,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Connect to WebSocket for real-time sync
   */
  /**
   * Apply base path to WebSocket URL (similar to fetch interceptor)
   */
  private _applyBasePathToWsUrl(url: string): string {
    // Skip if URL is already absolute or doesn't need base path
    if (!url.startsWith('/') || url.startsWith('http') || url.startsWith('ws')) {
      return url;
    }

    const basePath = getBasePath();
    const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

    return `${cleanBasePath}${url}`;
  }

  connectWebSocket(onMessage?: (data: any) => void, onError?: (error: Event) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Apply base path to WebSocket URL (same logic as fetch interceptor)
        let wsUrl = this._applyBasePathToWsUrl(this._wsUrl);

        // Include project ID in WebSocket URL if available

        if (this._projectId) {
          const separator = wsUrl.includes('?') ? '&' : '?';
          wsUrl = `${wsUrl}${separator}projectId=${encodeURIComponent(this._projectId)}`;
        }

        // Convert relative WebSocket URL to absolute URL with proper protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const absoluteWsUrl = wsUrl.startsWith('/') ? `${protocol}//${host}${wsUrl}` : wsUrl;

        // Check if dev mode is enabled
        const isDev = localStorage.getItem('dev') === 'true';

        if (!isDev) {
          // Production mode: Use Kubernetes authentication
          function getCookie(name: string) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);

            if (parts.length === 2) {
              return parts.pop()?.split(';').shift();
            }

            return '';
          }

          function base64urlEncode(str: string) {
            const base64 = btoa(str);

            return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          }

          const accessToken = getCookie('access_token') || '';
          const encodedToken = base64urlEncode(accessToken);
          const protocols = [`base64url.bearer.authorization.k8s.io.${encodedToken}`, 'base64.binary.k8s.io'];

          this._websocket = new WebSocket(absoluteWsUrl, protocols);
        } else {
          // Dev mode: Use regular WebSocket without authentication
          this._websocket = new WebSocket(absoluteWsUrl);
        }

        this._websocket.onopen = () => {
          logStore.logSystem('WebSocket connected to Fern API');
          this._reconnectAttempts = 0;
          resolve();
        };

        this._websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            logStore.logSystem(`WebSocket message received: ${data.type}`);
            onMessage?.(data);
          } catch (error) {
            logStore.logError('Failed to parse WebSocket message', error);
          }
        };

        this._websocket.onerror = (error) => {
          logStore.logError('WebSocket error', error);
          onError?.(error);
        };

        this._websocket.onclose = () => {
          logStore.logSystem('WebSocket disconnected from Fern API');
          this._websocket = null;

          // Auto-reconnect with exponential backoff
          if (this._reconnectAttempts < this._maxReconnectAttempts) {
            this._reconnectAttempts++;

            const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

            setTimeout(() => {
              logStore.logSystem(
                `Attempting WebSocket reconnection (${this._reconnectAttempts}/${this._maxReconnectAttempts})`,
              );
              this.connectWebSocket(onMessage, onError);
            }, delay);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this._websocket) {
      this._websocket.close();
      this._websocket = null;
      logStore.logSystem('WebSocket disconnected manually');
    }
  }

  /**
   * Send message through WebSocket
   */
  sendWebSocketMessage(message: any): void {
    if (this._websocket && this._websocket.readyState === WebSocket.OPEN) {
      this._websocket.send(JSON.stringify(message));
    } else {
      logStore.logError('WebSocket not connected, cannot send message');
    }
  }

  /**
   * Check WebSocket connection status
   */
  isWebSocketConnected(): boolean {
    return this._websocket !== null && this._websocket.readyState === WebSocket.OPEN;
  }

  /**
   * Update server configuration
   */
  updateConfig(baseUrl?: string, wsUrl?: string): void {
    if (baseUrl) {
      this._baseUrl = baseUrl;
    }

    if (wsUrl) {
      this._wsUrl = wsUrl;

      // Reconnect WebSocket if it was connected
      if (this._websocket) {
        this.disconnectWebSocket();

        // Note: Caller should reconnect manually after config update
      }
    }
  }
}

// Global instance
export const fernApiService = new FernApiService();
