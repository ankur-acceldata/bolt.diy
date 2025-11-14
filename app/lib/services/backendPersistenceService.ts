import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { ProjectService } from './projectService';
import { ChatSerializationService } from './chatSerializationService';
import type { IChatMetadata } from '~/lib/persistence/db';
import { logStore } from '~/lib/stores/logs';
import type { ProjectResponse, SessionsResponse, SessionResponse } from '~/types/backend-api';

const logger = createScopedLogger('BackendPersistenceService');

export interface BackendChatData {
  id: string;
  messages: Message[];
  description?: string;
  timestamp: string;
  metadata?: IChatMetadata;
  urlId?: string;
  projectId?: string;
}

/**
 * Service for persisting chat data to backend via ProjectService
 * This replaces IndexedDB storage with backend API storage
 */
export class BackendPersistenceService {
  /**
   * Save chat messages to backend
   * Flow:
   * 1. Check if project exists, create if not
   * 2. Get all sessions for the project
   * 3. If session exists, update it (append messages)
   * 4. If no session, create new session
   * This maintains a single session per project for ongoing conversations
   */
  static async saveChat(
    chatId: string,
    messages: Message[],
    description?: string,
    metadata?: IChatMetadata,
    projectId?: string,
    sessionId?: string,
  ): Promise<string> {
    try {
      logger.info(`Saving chat ${chatId} to backend with ${messages.length} messages`);
      logStore.logSystem('[BACKEND-PERSIST] Starting chat save to session', {
        chatId,
        projectId,
        sessionId,
        messageCount: messages.length,
        description,
      });

      // Use projectId if provided, otherwise use chatId as projectId
      const targetProjectId = projectId || chatId;

      // STEP 1: Ensure project exists and get project data
      let projectExists = false;
      let projectData: any = null;

      try {
        projectData = await ProjectService.getProject(targetProjectId);
        projectExists = !!projectData;
        logger.debug(`Project ${targetProjectId} exists:`, projectExists);
      } catch {
        logger.debug(`Project ${targetProjectId} does not exist, will create new one`);
        projectExists = false;
      }

      if (!projectExists) {
        logger.info(`Creating new project ${targetProjectId}`);
        logStore.logSystem('[BACKEND-PERSIST] Creating new project', { projectId: targetProjectId });

        await ProjectService.createProject({
          name: description || 'New Chat',
          description: description || 'New Chat',
        });

        logStore.logSystem('[BACKEND-PERSIST] Project created successfully', {
          projectId: targetProjectId,
        });
      }

      // STEP 2: Get all sessions for this project
      logger.info(`Fetching sessions for project ${targetProjectId}`);

      const sessionsResponse = await fetch(`/api/projects/${targetProjectId}/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      let existingSessionId: string | null = null;

      if (sessionsResponse.ok) {
        const sessionsResult = (await sessionsResponse.json()) as SessionsResponse;

        if (sessionsResult.success && sessionsResult.data) {
          const { extractSessionsArray } = await import('~/types/backend-api');
          const sessionsArray = extractSessionsArray(sessionsResult);

          if (sessionsArray.length > 0) {
            // Get the latest session (or specific session if sessionId provided)
            let targetSession;

            if (sessionId) {
              targetSession = sessionsArray.find((s) => String(s.id) === String(sessionId));
            } else {
              // Get latest session by updatedAt
              targetSession = sessionsArray.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
                const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();

                return dateB - dateA;
              })[0];
            }

            if (targetSession) {
              existingSessionId = String(targetSession.id);
              logger.info(`Found existing session ${existingSessionId} for project ${targetProjectId}`);
              logStore.logSystem('[BACKEND-PERSIST] Using existing session', {
                sessionId: existingSessionId,
                projectId: targetProjectId,
              });
            }
          }
        }
      }

      // STEP 3: Serialize messages to session string (description is stored in project metadata, not session)
      const sessionString = ChatSerializationService.serializeMessages(messages, metadata);

      logStore.logSystem('[BACKEND-PERSIST] Messages serialized', {
        sessionStringLength: sessionString.length,
        messageCount: messages.length,
        existingSessionId,
      });

      /*
       * STEP 4: Create or update session
       * Extract dataplaneId from project data (handle nested structure)
       */
      const { extractProjectData: extractData } = await import('~/types/backend-api');
      const extractedProjectData = projectData ? extractData(projectData as ProjectResponse) : null;
      const dataplaneId = extractedProjectData?.dataplaneId;

      const sessionData: any = {
        projectId: Number(targetProjectId),
        session: sessionString,
        ...(dataplaneId && { dataplaneId }),
        ...(existingSessionId && { id: Number(existingSessionId) }),
      };

      logger.info(`${existingSessionId ? 'Updating' : 'Creating'} session for project ${targetProjectId}`);
      logStore.logSystem(`[BACKEND-PERSIST] ${existingSessionId ? 'Updating' : 'Creating'} session`, {
        projectId: targetProjectId,
        sessionId: existingSessionId,
        chatId,
        dataplaneId,
      });

      // Use POST for creating new session, PUT for updating existing session
      const method = existingSessionId ? 'PUT' : 'POST';
      const url = existingSessionId
        ? `/api/projects/${targetProjectId}/sessions/${existingSessionId}`
        : `/api/projects/${targetProjectId}/sessions`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error(`Failed to save session: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as SessionResponse;

      if (!result.success) {
        throw new Error(result.error || 'Failed to save session');
      }

      // Extract the session ID from response
      const savedSessionId = existingSessionId || result.data?.id || result.data?.data?.id;
      const finalSessionId = savedSessionId ? String(savedSessionId) : '';

      logStore.logSystem('[BACKEND-PERSIST] Session saved successfully', {
        projectId: targetProjectId,
        sessionId: finalSessionId,
        chatId,
      });

      logger.info(`Successfully saved chat ${chatId} to backend session ${finalSessionId}`);

      return finalSessionId;
    } catch (error) {
      logger.error(`Failed to save chat ${chatId} to backend:`, error);
      logStore.logError('[BACKEND-PERSIST] Failed to save chat', error);
      throw error;
    }
  }

  /**
   * Load chat messages from backend
   * Fetches sessions for a project and returns the latest/specific session
   */
  static async loadChat(projectId: string, sessionId?: string): Promise<BackendChatData | null> {
    try {
      logger.info(`Loading chat for project ${projectId}, session: ${sessionId || 'latest'}`);
      logStore.logSystem('[BACKEND-PERSIST] Loading chat from backend', { projectId, sessionId });

      // Fetch all sessions for the project
      const response = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const result = (await response.json()) as SessionsResponse;

      if (!result.success || !result.data) {
        logger.info(`No sessions found for project ${projectId}`);
        logStore.logSystem('[BACKEND-PERSIST] No sessions found', { projectId });

        return null;
      }

      // Extract sessions array from nested structure
      const { extractSessionsArray } = await import('~/types/backend-api');
      const sessionsArray = extractSessionsArray(result);

      if (sessionsArray.length === 0) {
        logger.info(`No sessions available for project ${projectId}`);
        return null;
      }

      logStore.logSystem('[BACKEND-PERSIST] Sessions loaded', {
        projectId,
        sessionCount: sessionsArray.length,
      });

      // Get the latest session or specific session
      let targetSession;

      if (sessionId) {
        targetSession = sessionsArray.find((s) => String(s.id) === String(sessionId));
      } else {
        // Get latest session (highest ID or most recent updatedAt)
        targetSession = sessionsArray.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();

          return dateB - dateA;
        })[0];
      }

      if (!targetSession) {
        logger.warn(`Session not found for project ${projectId}`);
        return null;
      }

      // Extract session string
      const sessionString = targetSession.session || '';

      logStore.logSystem('[BACKEND-PERSIST] Session string extracted', {
        projectId,
        sessionId: targetSession.id,
        hasSession: !!sessionString,
        sessionLength: sessionString.length,
      });

      // Deserialize messages from session string
      const { messages, metadata, description, timestamp } =
        ChatSerializationService.deserializeMessages(sessionString);

      logStore.logSystem('[BACKEND-PERSIST] Messages deserialized', {
        projectId,
        sessionId: targetSession.id,
        messageCount: messages.length,
        hasMetadata: !!metadata,
      });

      logger.info(`Successfully loaded chat for project ${projectId} with ${messages.length} messages`);

      // Merge metadata with sessionId, ensuring gitUrl is present
      const baseMetadata = metadata || targetSession.metadata || {};
      const finalMetadata: IChatMetadata = {
        gitUrl: baseMetadata.gitUrl || '',
        gitBranch: baseMetadata.gitBranch,
        netlifySiteId: baseMetadata.netlifySiteId,
        projectId: baseMetadata.projectId || String(projectId),
        sessionId: String(targetSession.id), // Store session ID in metadata for tracking
      };

      return {
        id: String(projectId), // Use project ID as chat ID
        messages,
        description: description || targetSession.description || 'Chat Session',
        timestamp: timestamp || targetSession.updatedAt || targetSession.createdAt || new Date().toISOString(),
        metadata: finalMetadata,
        urlId: String(projectId), // Use project ID as urlId
        projectId: String(projectId),
      };
    } catch (error) {
      logger.error(`Failed to load chat for project ${projectId}:`, error);
      logStore.logError('[BACKEND-PERSIST] Failed to load chat', error);

      return null;
    }
  }

  /**
   * Get all chats from backend
   * Returns list of all projects with their chat data
   */
  static async getAllChats(): Promise<BackendChatData[]> {
    try {
      logger.info('Loading all chats from backend');
      logStore.logSystem('[BACKEND-PERSIST] Loading all chats from backend');

      /*
       * This would require a new endpoint to list all projects
       * For now, we'll return empty array and implement when endpoint is available
       */
      logger.warn('getAllChats not yet implemented - requires backend list endpoint');
      logStore.logSystem('[BACKEND-PERSIST] getAllChats not implemented yet');

      return [];
    } catch (error) {
      logger.error('Failed to load all chats from backend:', error);
      logStore.logError('[BACKEND-PERSIST] Failed to load all chats', error);

      return [];
    }
  }

  /**
   * Delete a chat from backend
   */
  static async deleteChat(chatId: string): Promise<void> {
    try {
      logger.info(`Deleting chat ${chatId} from backend`);
      logStore.logSystem('[BACKEND-PERSIST] Deleting chat from backend', { chatId });

      /*
       * This would require a DELETE endpoint
       * For now, we can update the project with empty session
       */
      await ProjectService.updateProject(chatId, {
        userSession: {
          session: '',
        },
      });

      logger.info(`Successfully deleted chat ${chatId} from backend`);
      logStore.logSystem('[BACKEND-PERSIST] Chat deleted successfully', { chatId });
    } catch (error) {
      logger.error(`Failed to delete chat ${chatId} from backend:`, error);
      logStore.logError('[BACKEND-PERSIST] Failed to delete chat', error);
      throw error;
    }
  }

  /**
   * Update only the description of a chat without reloading all messages
   */
  static async updateChatDescription(chatId: string, description: string): Promise<void> {
    try {
      logger.info(`Updating description for chat ${chatId}`);
      logStore.logSystem('[BACKEND-PERSIST] Updating chat description', {
        chatId,
        description,
      });

      await ProjectService.updateProject(chatId, {
        name: description,
        description,
      });

      logger.info(`Successfully updated description for chat ${chatId}`);
      logStore.logSystem('[BACKEND-PERSIST] Description updated successfully', { chatId });
    } catch (error) {
      logger.error(`Failed to update description for chat ${chatId}:`, error);
      logStore.logError('[BACKEND-PERSIST] Failed to update description', error);
      throw error;
    }
  }

  /**
   * Append messages to existing chat without reloading
   * This is an optimization to avoid deserializing and re-serializing all messages
   */
  static async appendMessages(chatId: string, newMessages: Message[]): Promise<void> {
    try {
      logger.info(`Appending ${newMessages.length} messages to chat ${chatId}`);
      logStore.logSystem('[BACKEND-PERSIST] Appending messages', {
        chatId,
        newMessageCount: newMessages.length,
      });

      // Load existing chat
      const existingChat = await this.loadChat(chatId);

      if (!existingChat) {
        logger.warn(`Chat ${chatId} not found, creating new chat with messages`);
        await this.saveChat(chatId, newMessages);

        return;
      }

      // Merge messages
      const allMessages = [...existingChat.messages, ...newMessages];

      // Save back
      await this.saveChat(chatId, allMessages, existingChat.description, existingChat.metadata);

      logger.info(`Successfully appended messages to chat ${chatId}`);
      logStore.logSystem('[BACKEND-PERSIST] Messages appended successfully', { chatId });
    } catch (error) {
      logger.error(`Failed to append messages to chat ${chatId}:`, error);
      logStore.logError('[BACKEND-PERSIST] Failed to append messages', error);
      throw error;
    }
  }

  /**
   * Check if backend persistence is available
   * This can be used to fallback to IndexedDB if backend is unavailable
   */
  static async isAvailable(): Promise<boolean> {
    try {
      /*
       * Try to make a simple request to check if backend is available
       * For now, we'll assume it's always available
       */
      return true;
    } catch {
      return false;
    }
  }
}
