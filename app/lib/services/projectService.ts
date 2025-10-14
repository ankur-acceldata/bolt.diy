import { createScopedLogger } from '~/utils/logger';
import { PostMessageService } from './postMessageService';
import { MessageType } from '~/types/communicationBus';
import type { DataplaneInfoPayload } from '~/types/communicationBus';
import { getCurrentChatId, setProjectId } from '~/utils/fileLocks';
import { logStore } from '~/lib/stores/logs';

const logger = createScopedLogger('ProjectService');

export interface ProjectCreationData {
  id?: number;
  name?: string;
  description?: string;
  url?: string;
  dataplaneId?: number;
  userSession?: {
    projectId?: number;
    session?: string;
    dataplaneId?: number;
  };

  // Add other fields your backend expects
}

export interface CommunicationBus {
  sendMessageWithResponse<T = any, R = any>(
    message: {
      type: string;
      payload?: T;
    },
    options?: {
      timeout?: number;
      responseType?: string;
    },
  ): Promise<R>;
}

export interface ProjectResponse {
  id: string;

  // Add other fields from your project metadata response
  [key: string]: any;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  userId: string;
  dataplaneId: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  enabled: boolean;
  globalShared: boolean;
}

export interface ProjectsMetadata {
  size: number;
  page: number;
  count: number;
}

export interface ProjectsListResponse {
  errorCode: number;
  success: boolean;
  message: string;
  detailedMessage: string;
  data: {
    projects: Project[];
    meta: ProjectsMetadata;
  };
  meta: null;
}

export interface GetProjectsOptions {
  page?: number;
  size?: number;
}

export class ProjectService {
  /**
   * Get dataplaneId from communication bus
   */
  private static async _getDataplaneId(bus?: CommunicationBus): Promise<number | undefined> {
    try {
      logger.info('Starting dataplaneId fetch using request-response pattern...');

      if (!bus) {
        logger.info('No communication bus provided, trying to create temporary one...');

        // Create a temporary communication bus instance only if none provided
        const tempBus = new PostMessageService({ timeout: 10000 });

        // Critical: Mark bus as ready to send messages immediately
        tempBus.setReady();

        // Wait for parent handlers to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Only attempt if we're in an iframe environment
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
          try {
            const response = await tempBus.sendMessageWithResponse<{}, DataplaneInfoPayload>(
              {
                type: MessageType.GET_DATAPLANE_INFO,
              },
              {
                responseType: MessageType.GET_DATAPLANE_INFO_RESPONSE,
                timeout: 10000,
              },
            );

            const dataplaneId = response?.dataplaneId ? Number(response.dataplaneId) : undefined;

            // Clean up the temporary bus
            tempBus.destroy();

            return dataplaneId;
          } catch (error) {
            logger.error('PostMessageService failed, will try direct approach:', error);
            tempBus.destroy();

            // Fallback to direct postMessage approach
            return await ProjectService._getDataplaneIdDirect();
          }
        }

        tempBus.destroy();

        return undefined;
      }

      // Use provided bus instance
      const response = await bus.sendMessageWithResponse<{}, DataplaneInfoPayload>(
        {
          type: MessageType.GET_DATAPLANE_INFO,
        },
        {
          responseType: MessageType.GET_DATAPLANE_INFO_RESPONSE,
          timeout: 10000,
        },
      );

      const dataplaneId = response?.dataplaneId ? Number(response.dataplaneId) : undefined;

      return dataplaneId;
    } catch (error) {
      logger.warn('Failed to get dataplaneId from communication bus:', error);
      return undefined;
    }
  }

  /**
   * Direct postMessage fallback for getting dataplane info
   */
  private static async _getDataplaneIdDirect(): Promise<number | undefined> {
    try {
      if (typeof window === 'undefined' || !window.parent || window.parent === window) {
        return undefined;
      }

      const messageId = `dataplane-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Send request directly
      const requestMessage = {
        type: 'GET_DATAPLANE_INFO',
        messageId,
        timestamp: Date.now(),
        source: 'bolt.diy',
      };

      window.parent.postMessage(requestMessage, '*');

      // Listen for response
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          resolve(undefined);
        }, 10000);

        const messageHandler = (event: MessageEvent) => {
          if (event.data.type === 'GET_DATAPLANE_INFO_RESPONSE' && event.data.responseId === messageId) {
            clearTimeout(timeout);
            window.removeEventListener('message', messageHandler);

            const dataplaneId = event.data.payload?.dataplaneId ? Number(event.data.payload.dataplaneId) : undefined;
            resolve(dataplaneId);
          }
        };

        window.addEventListener('message', messageHandler);
      });
    } catch {
      return undefined;
    }
  }

  /**
   * Public utility function to get dataplane info from parent iframe
   * Can be used throughout the application
   */
  static async getDataplaneInfo(): Promise<DataplaneInfoPayload | undefined> {
    try {
      const dataplaneId = await this._getDataplaneId();

      if (dataplaneId) {
        return {
          dataplaneId: String(dataplaneId),
          dataplaneName: `Dataplane ${dataplaneId}`, // Fallback name
        };
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Create a new project by calling /api/projects and return the projectId
   */
  static async createProject(data: ProjectCreationData = {}, bus?: CommunicationBus): Promise<string> {
    try {
      logger.info('=== ProjectService.createProject CALLED ===');
      logger.info('Input data:', data);

      // Get dataplaneId from communication bus
      logger.info('Calling _getDataplaneId...');

      const dataplaneId = await this._getDataplaneId(bus);

      logger.info('Received dataplaneId:', dataplaneId);

      const finalDataplaneId = data.dataplaneId || dataplaneId || 45; // Fallback to 45 if not available

      logger.info('Final dataplaneId to use:', finalDataplaneId);

      // Create the complete payload structure matching your original format
      const projectData: ProjectCreationData = {
        name: data.name || '',
        description: data.description || '',
        url: data.url || '',
        dataplaneId: finalDataplaneId,
        userSession: {
          session: data.userSession?.session || '',
          dataplaneId: data.userSession?.dataplaneId || finalDataplaneId,
        },
        ...data, // Include any additional fields
      };

      logger.info('Creating project with data:', projectData);
      logger.info('=== MAKING API CALL TO /api/projects ===');

      let response;

      try {
        response = await fetch('/api/projects', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(projectData),
        });

        logStore.logSystem('[FERN-DEBUG] Project API response received', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: response.url,
        });
      } catch (fetchError: any) {
        logStore.logError('[FERN-DEBUG] Project API fetch failed', fetchError);
        logStore.logSystem('[FERN-DEBUG] Fetch error details', {
          message: fetchError.message,
          stack: fetchError.stack,
          fullError: JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError)),
        });
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error text');
        logStore.logError('[FERN-DEBUG] Project API request failed', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        throw new Error(`Project creation failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      let result: any;

      try {
        result = await response.json();
        logStore.logSystem('[FERN-DEBUG] Project API JSON response parsed', {
          success: result?.success,
          hasData: !!result?.data,
          resultKeys: Object.keys(result || {}),
        });
      } catch (jsonError: any) {
        logStore.logError('[FERN-DEBUG] Failed to parse project API JSON response', jsonError);
        throw new Error(`Failed to parse API response: ${jsonError.message}`);
      }

      if (!result.success) {
        logStore.logError('[FERN-DEBUG] Project API returned unsuccessful result', {
          success: result.success,
          error: result.error,
          fullResult: JSON.stringify(result),
        });
        throw new Error(result.error || 'Project creation failed');
      }

      // Handle nested response structure: result.data.data.id
      const responseData = result.data?.data || result.data;

      logStore.logSystem('[FERN-DEBUG] Processing project response data', {
        hasResponseData: !!responseData,
        responseDataKeys: Object.keys(responseData || {}),
        id: responseData?.id,
        idType: typeof responseData?.id,
      });

      if (!responseData?.id) {
        logger.error('Project response structure:', JSON.stringify(result, null, 2));
        logStore.logError('[FERN-DEBUG] Project response missing id', {
          responseData,
          fullResult: result,
        });
        throw new Error('Project response missing id');
      }

      logger.info('Created backend project:', responseData.id);

      // Store the backend project ID mapping for both current (possibly 'default') and real IDs
      const currentChatId = getCurrentChatId();

      try {
        // Map whatever the current chatId is (often 'default' pre-URL update) to the backend project id
        setProjectId(currentChatId, responseData.id);

        // Also assert the unified mapping: realId -> realId
        setProjectId(responseData.id.toString(), responseData.id.toString());

        // Persist a recent project ID for robust fallback discovery
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('bolt_recent_project_id', responseData.id.toString());
          } catch {}
        }
      } catch (e) {
        logger.warn('Failed to persist project ID mappings to localStorage', e);
      }

      // Trigger immediate sync initialization after project ID is set
      try {
        // Use setTimeout to ensure setProjectId has completed
        setTimeout(async () => {
          logStore.logSystem('[FERN-DEBUG] Triggering immediate sync after project creation', {
            projectId: responseData.id,
            currentChatId,
          });

          // Dispatch a custom event to notify sync services
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('project-created', {
                detail: {
                  projectId: responseData.id,

                  // Send the real chatId (backend project id) to avoid reliance on polling/aliases
                  chatId: responseData.id.toString(),
                },
              }),
            );
          }
        }, 10); // Small delay to ensure setProjectId is persisted
      } catch (syncTriggerError) {
        logStore.logError('[FERN-DEBUG] Failed to trigger immediate sync', syncTriggerError);

        // Don't throw here - project creation should still succeed
      }

      logStore.logSystem('[FERN-DEBUG] Project creation completed successfully', {
        projectId: responseData.id,
        currentChatId,
        timestamp: new Date().toISOString(),
      });

      return responseData.id;
    } catch (error) {
      logger.error('Project creation failed:', error);
      throw error;
    }
  }

  /**
   * Update an existing project by ID
   */
  static async updateProject(
    projectId: string,
    data: Partial<ProjectCreationData> = {},
    bus?: CommunicationBus,
  ): Promise<ProjectResponse> {
    try {
      logger.info('=== ProjectService.updateProject CALLED ===');
      logger.info('Project ID:', projectId);
      logger.info('Update data:', data);

      // Get dataplaneId from communication bus if not provided
      let finalDataplaneId = data.dataplaneId;

      if (!finalDataplaneId) {
        logger.info('No dataplaneId provided, fetching from communication bus...');

        const dataplaneId = await this._getDataplaneId(bus);

        finalDataplaneId = dataplaneId || 45; // Fallback to 45 if not available
      }

      logger.info('Final dataplaneId to use:', finalDataplaneId);

      // Build the URL using the same pattern as adhoc-run: codeSourceUrl/projectId
      const codeSourceUrl = 'home/projects'; // From executionConfig.ts template defaults
      const projectUrl = `${codeSourceUrl}/${projectId}`;

      // Create the update payload with the same structure as creation
      const updateData: ProjectCreationData = {
        id: Number(projectId),
        name: data.name || data.description || 'Updated Project', // Use description as name if name not provided
        description: data.description || data.name || 'Updated Project Description',
        url: projectUrl, // Use the adhoc-run URL pattern
        dataplaneId: finalDataplaneId,
        userSession: {
          projectId: Number(projectId),
          session: data.userSession?.session || '', // Empty as requested
          dataplaneId: data.userSession?.dataplaneId || finalDataplaneId,
        },
        ...data, // Include any additional fields
      };

      logger.info('Updating project with data:', updateData);
      logger.info('=== MAKING API CALL TO PUT /api/projects/${projectId} ===');

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Project update failed: ${response.status} ${response.statusText}`);
      }

      const result: any = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Project update failed');
      }

      // Handle nested response structure: result.data.data.id or result.data.id
      const responseData = result.data?.data || result.data;

      if (!responseData?.id) {
        logger.error('Project update response structure:', JSON.stringify(result, null, 2));
        throw new Error('Project update response missing id');
      }

      logger.info('Updated backend project:', responseData.id);

      // Store the backend project ID for GET_PROJECT_ID requests
      const currentChatId = getCurrentChatId();
      setProjectId(currentChatId, responseData.id);

      return responseData;
    } catch (error) {
      logger.error('Project update failed:', error);
      throw error;
    }
  }

  /**
   * Get project details by ID
   */
  static async getProject(projectId: string): Promise<ProjectResponse> {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Project fetch failed: ${response.status} ${response.statusText}`);
      }

      const result: any = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Project fetch failed');
      }

      return result.data;
    } catch (error) {
      logger.error('Project fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get all projects with pagination support
   * @param options - Options for fetching projects
   * @param options.page - Page number (0-based index, defaults to 0)
   * @param options.size - Number of items per page (defaults to 25)
   * @returns Promise with paginated projects list response
   */
  static async getAllProjects(options: GetProjectsOptions = {}): Promise<ProjectsListResponse> {
    const { page = 0, size = 25 } = options;

    try {
      logger.info('=== ProjectService.getAllProjects CALLED ===');
      logger.info('Options:', { page, size });

      const response = await fetch(`/api/projects?page=${page}&size=${size}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Projects fetch failed: ${response.status} ${response.statusText}`);
      }

      const result: any = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Projects fetch failed');
      }

      logger.info('Successfully fetched projects:', {
        count: result.data?.projects?.length,
        totalCount: result.data?.meta?.count,
        page: result.data?.meta?.page,
        size: result.data?.meta?.size,
      });

      return result;
    } catch (error) {
      logger.error('Projects fetch failed:', error);
      throw error;
    }
  }
}
