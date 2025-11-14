import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { IChatMetadata } from '~/lib/persistence/db';

/**
 * Extended types for AI SDK Message properties
 * These types handle the runtime structure of tool invocations and attachments
 */
interface ToolInvocationWithResult {
  toolCallId: string;
  toolName: string;
  args: any;
  state: string;
  result?: any; // Result is optional and added at runtime
}

const logger = createScopedLogger('ChatSerializationService');

/**
 * Structure for serialized chat data that will be stored in backend session string
 */
export interface SerializedChatData {
  version: string; // Format version for future compatibility
  messages: SerializedMessage[];
  metadata?: IChatMetadata;
  description?: string;
  timestamp: string;
}

/**
 * Simplified message structure for serialization
 * Only includes essential fields to minimize payload size
 */
export interface SerializedMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: number;

  // Store experimental_attachments as simplified structure
  attachments?: Array<{
    name?: string;
    contentType?: string;
    url?: string;
  }>;

  // Store tool invocations if present
  toolInvocations?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    state: string;
    result?: any;
  }>;
}

/**
 * Service for serializing and deserializing chat messages to/from backend session format
 */
export class ChatSerializationService {
  private static readonly _version = '1.0.0';

  /**
   * Serialize messages to a JSON string for backend storage
   * The backend expects session as a string, so we JSON.stringify the entire chat data
   */
  static serializeMessages(messages: Message[], metadata?: IChatMetadata): string {
    try {
      const serializedMessages: SerializedMessage[] = messages.map((msg) => {
        const serialized: SerializedMessage = {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          createdAt: msg.createdAt?.getTime(),
        };

        // Include attachments if present
        if (msg.experimental_attachments && msg.experimental_attachments.length > 0) {
          serialized.attachments = msg.experimental_attachments.map((att) => ({
            name: att.name,
            contentType: att.contentType,
            url: att.url,
          }));
        }

        // Include tool invocations if present
        if (msg.toolInvocations && msg.toolInvocations.length > 0) {
          serialized.toolInvocations = msg.toolInvocations.map((inv) => {
            const invWithResult = inv as ToolInvocationWithResult;

            return {
              toolCallId: invWithResult.toolCallId,
              toolName: invWithResult.toolName,
              args: invWithResult.args,
              state: invWithResult.state,
              result: invWithResult.result,
            };
          });
        }

        return serialized;
      });

      const chatData: SerializedChatData = {
        version: this._version,
        messages: serializedMessages,
        metadata,
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(chatData);
      logger.debug(`Serialized ${messages.length} messages (${serialized.length} bytes)`);

      return serialized;
    } catch (error) {
      logger.error('Failed to serialize messages:', error);
      throw new Error(`Chat serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize messages from backend session string
   */
  static deserializeMessages(sessionString: string): {
    messages: Message[];
    metadata?: IChatMetadata;
    description?: string;
    timestamp?: string;
  } {
    try {
      if (!sessionString || sessionString.trim() === '') {
        logger.debug('Empty session string, returning empty messages');
        return {
          messages: [],
          metadata: undefined,
          description: undefined,
          timestamp: new Date().toISOString(),
        };
      }

      const chatData: SerializedChatData = JSON.parse(sessionString);

      // Validate version (for future compatibility)
      if (!chatData.version) {
        logger.warn('Session data missing version, attempting to parse anyway');
      }

      const messages: Message[] = chatData.messages.map((serialized) => {
        const message: Message = {
          id: serialized.id,
          role: serialized.role,
          content: serialized.content,
          createdAt: serialized.createdAt ? new Date(serialized.createdAt) : undefined,
        };

        // Restore attachments if present
        if (serialized.attachments && serialized.attachments.length > 0) {
          message.experimental_attachments = serialized.attachments.map((att) => ({
            name: att.name,
            contentType: att.contentType,
            url: att.url,
          })) as Message['experimental_attachments'];
        }

        // Restore tool invocations if present
        if (serialized.toolInvocations && serialized.toolInvocations.length > 0) {
          message.toolInvocations = serialized.toolInvocations.map((inv) => ({
            toolCallId: inv.toolCallId,
            toolName: inv.toolName,
            args: inv.args,
            state: inv.state,
            result: inv.result,
          })) as Message['toolInvocations'];
        }

        return message;
      });

      logger.debug(`Deserialized ${messages.length} messages from session string`);

      return {
        messages,
        metadata: chatData.metadata,
        description: chatData.description,
        timestamp: chatData.timestamp,
      };
    } catch (error) {
      logger.error('Failed to deserialize messages:', error);

      // Return empty messages rather than throwing to allow graceful degradation
      return {
        messages: [],
        metadata: undefined,
        description: undefined,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate that a session string is valid JSON and has the expected structure
   */
  static validateSessionString(sessionString: string): boolean {
    try {
      if (!sessionString || sessionString.trim() === '') {
        return true; // Empty is valid (new chat)
      }

      const chatData = JSON.parse(sessionString);

      return (
        chatData &&
        typeof chatData === 'object' &&
        Array.isArray(chatData.messages) &&
        typeof chatData.timestamp === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Get a summary of chat data without full deserialization
   * Useful for listing chats without loading all messages
   */
  static getSessionSummary(sessionString: string): {
    messageCount: number;
    description?: string;
    timestamp?: string;
    lastMessagePreview?: string;
  } {
    try {
      if (!sessionString || sessionString.trim() === '') {
        return { messageCount: 0 };
      }

      const chatData: SerializedChatData = JSON.parse(sessionString);

      const lastMessage = chatData.messages[chatData.messages.length - 1];
      const lastMessagePreview = lastMessage
        ? lastMessage.content.substring(0, 100) + (lastMessage.content.length > 100 ? '...' : '')
        : undefined;

      return {
        messageCount: chatData.messages.length,
        description: chatData.description,
        timestamp: chatData.timestamp,
        lastMessagePreview,
      };
    } catch {
      return { messageCount: 0 };
    }
  }

  /**
   * Merge new messages with existing session data
   * Useful for incremental updates without re-serializing everything
   */
  static appendMessages(existingSessionString: string, newMessages: Message[]): string {
    try {
      const existing = this.deserializeMessages(existingSessionString);
      const allMessages = [...existing.messages, ...newMessages];

      return this.serializeMessages(allMessages, existing.metadata);
    } catch (error) {
      logger.error('Failed to append messages:', error);
      throw error;
    }
  }

  /**
   * Update only the metadata without touching messages
   */
  static updateMetadata(existingSessionString: string, metadata: IChatMetadata, _description?: string): string {
    try {
      const existing = this.deserializeMessages(existingSessionString);

      return this.serializeMessages(existing.messages, metadata);
    } catch (error) {
      logger.error('Failed to update metadata:', error);
      throw error;
    }
  }
}
