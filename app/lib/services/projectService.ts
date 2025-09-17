import { createScopedLogger } from '~/utils/logger';
import { PostMessageService } from './postMessageService';
import { MessageType } from '~/types/communicationBus';
import type { JobConfig } from '~/types/jobConfig';

const logger = createScopedLogger('ProjectService');

export interface ProjectCreationData {
  name?: string;
  description?: string;
  url?: string;
  dataplaneId?: number;
  userSession?: {
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

export class ProjectService {
  /**
   * Get dataplaneId from communication bus
   */
  private static async _getDataplaneId(bus?: CommunicationBus): Promise<number | undefined> {
    try {
      logger.info('Starting dataplaneId fetch...');

      if (!bus) {
        logger.info('No communication bus provided, trying to create temporary one...');

        // Create a temporary communication bus instance only if none provided
        const tempBus = new PostMessageService({ timeout: 10000 });

        // Only attempt if we're in an iframe environment
        if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
          logger.info('In iframe environment, attempting to get dataplaneId...');

          const response = await tempBus.sendMessageWithResponse<{ stages: string[] }, JobConfig>(
            {
              type: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
              payload: {
                stages: [], // Empty stages for getting default config
              },
            },
            {
              responseType: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG_RESPONSE,
              timeout: 10000,
            },
          );

          logger.info('Received response from communication bus:', JSON.stringify(response, null, 2));

          // Handle both array and single object responses (like adhoc-run does)
          const jobConfig = Array.isArray(response) ? response[0] : response;
          const dataplaneId = jobConfig?.dataplaneId ? Number(jobConfig.dataplaneId) : undefined;
          logger.info('Extracted job config:', jobConfig);
          logger.info('Retrieved dataplaneId from communication bus:', dataplaneId);

          // Clean up the temporary bus
          tempBus.destroy();

          return dataplaneId;
        }

        logger.info('Not in iframe environment, no dataplaneId available');
        tempBus.destroy();

        return undefined;
      }

      // Use provided bus instance
      logger.info('Using provided communication bus...');

      const response = await bus.sendMessageWithResponse<{ stages: string[] }, JobConfig>(
        {
          type: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
          payload: {
            stages: [], // Empty stages for getting default config
          },
        },
        {
          responseType: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG_RESPONSE,
          timeout: 10000,
        },
      );

      logger.info('Received response from communication bus:', JSON.stringify(response, null, 2));

      // Handle both array and single object responses (like adhoc-run does)
      const jobConfig = Array.isArray(response) ? response[0] : response;
      const dataplaneId = jobConfig?.dataplaneId ? Number(jobConfig.dataplaneId) : undefined;
      logger.info('Extracted job config:', jobConfig);
      logger.info('Retrieved dataplaneId from communication bus:', dataplaneId);

      return dataplaneId;
    } catch (error) {
      logger.warn('Failed to get dataplaneId from communication bus:', error);

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

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        throw new Error(`Project creation failed: ${response.status} ${response.statusText}`);
      }

      const result: any = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Project creation failed');
      }

      // Handle nested response structure: result.data.data.id
      const responseData = result.data?.data || result.data;

      if (!responseData?.id) {
        logger.error('Project response structure:', JSON.stringify(result, null, 2));
        throw new Error('Project response missing id');
      }

      logger.info('Created backend project:', responseData.id);

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
        name: data.name || data.description || 'Updated Project', // Use description as name if name not provided
        description: data.description || data.name || 'Updated Project Description',
        url: projectUrl, // Use the adhoc-run URL pattern
        dataplaneId: finalDataplaneId,
        userSession: {
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
}
