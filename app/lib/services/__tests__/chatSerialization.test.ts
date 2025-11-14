import { describe, it, expect } from 'vitest';
import type { Message } from 'ai';
import { ChatSerializationService } from '~/lib/services/chatSerializationService';
import type { IChatMetadata } from '~/lib/persistence/db';

describe('ChatSerializationService', () => {
  describe('serializeMessages', () => {
    it('should serialize simple messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages);
      expect(serialized).toBeTruthy();
      expect(typeof serialized).toBe('string');

      const parsed = JSON.parse(serialized);
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.messages).toHaveLength(2);
      expect(parsed.messages[0].id).toBe('msg-1');
      expect(parsed.messages[0].content).toBe('Hello');
    });

    it('should serialize messages with metadata', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
        },
      ];

      const metadata: IChatMetadata = {
        gitUrl: 'https://github.com/test/repo',
        gitBranch: 'main',
        projectId: '123',
      };

      const serialized = ChatSerializationService.serializeMessages(messages, metadata);
      const parsed = JSON.parse(serialized);

      expect(parsed.metadata).toEqual(metadata);
    });

    it('should serialize messages with attachments', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Check this file',
          experimental_attachments: [
            {
              name: 'test.txt',
              contentType: 'text/plain',
              url: 'https://example.com/test.txt',
            },
          ],
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages);
      const parsed = JSON.parse(serialized);

      expect(parsed.messages[0].attachments).toHaveLength(1);
      expect(parsed.messages[0].attachments[0].name).toBe('test.txt');
    });

    it('should serialize messages with tool invocations', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Running tool',
          toolInvocations: [
            {
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'test' },
              state: 'result',
              result: { data: 'found' },
            },
          ],
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages);
      const parsed = JSON.parse(serialized);

      expect(parsed.messages[0].toolInvocations).toHaveLength(1);
      expect(parsed.messages[0].toolInvocations[0].toolName).toBe('search');
    });
  });

  describe('deserializeMessages', () => {
    it('should deserialize simple messages', () => {
      const original: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(original);
      const { messages } = ChatSerializationService.deserializeMessages(serialized);

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].content).toBe('Hello');
      expect(messages[1].id).toBe('msg-2');
      expect(messages[1].content).toBe('Hi there!');
    });

    it('should deserialize messages with metadata', () => {
      const original: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
        },
      ];

      const metadata: IChatMetadata = {
        gitUrl: 'https://github.com/test/repo',
        gitBranch: 'main',
        projectId: '123',
      };

      const serialized = ChatSerializationService.serializeMessages(original, metadata);
      const result = ChatSerializationService.deserializeMessages(serialized);

      expect(result.metadata).toEqual(metadata);
    });

    it('should handle empty session string', () => {
      const { messages } = ChatSerializationService.deserializeMessages('');
      expect(messages).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const { messages } = ChatSerializationService.deserializeMessages('invalid json');
      expect(messages).toHaveLength(0);
    });

    it('should restore attachments', () => {
      const original: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Check this file',
          experimental_attachments: [
            {
              name: 'test.txt',
              contentType: 'text/plain',
              url: 'https://example.com/test.txt',
            },
          ],
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(original);
      const { messages } = ChatSerializationService.deserializeMessages(serialized);

      expect(messages[0].experimental_attachments).toHaveLength(1);
      expect(messages[0].experimental_attachments![0].name).toBe('test.txt');
    });

    it('should restore tool invocations', () => {
      const original: Message[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Running tool',
          toolInvocations: [
            {
              toolCallId: 'call-1',
              toolName: 'search',
              args: { query: 'test' },
              state: 'result',
              result: { data: 'found' },
            },
          ],
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(original);
      const { messages } = ChatSerializationService.deserializeMessages(serialized);

      expect(messages[0].toolInvocations).toHaveLength(1);
      expect(messages[0].toolInvocations![0].toolName).toBe('search');
    });
  });

  describe('validateSessionString', () => {
    it('should validate valid session string', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages);
      expect(ChatSerializationService.validateSessionString(serialized)).toBe(true);
    });

    it('should accept empty string', () => {
      expect(ChatSerializationService.validateSessionString('')).toBe(true);
    });

    it('should reject invalid JSON', () => {
      expect(ChatSerializationService.validateSessionString('invalid json')).toBe(false);
    });

    it('should reject malformed structure', () => {
      expect(ChatSerializationService.validateSessionString('{"wrong": "structure"}')).toBe(false);
    });
  });

  describe('getSessionSummary', () => {
    it('should return summary without full deserialization', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages, undefined);
      const summary = ChatSerializationService.getSessionSummary(serialized);

      expect(summary.messageCount).toBe(2);
      expect(summary.lastMessagePreview).toBe('Second message');
    });

    it('should handle empty session', () => {
      const summary = ChatSerializationService.getSessionSummary('');
      expect(summary.messageCount).toBe(0);
    });

    it('should truncate long messages', () => {
      const longContent = 'a'.repeat(150);
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: longContent,
        },
      ];

      const serialized = ChatSerializationService.serializeMessages(messages);
      const summary = ChatSerializationService.getSessionSummary(serialized);

      expect(summary.lastMessagePreview!.length).toBeLessThanOrEqual(103); // 100 + '...'
    });
  });

  describe('appendMessages', () => {
    it('should append new messages to existing session', () => {
      const existingMessages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First',
        },
      ];

      const newMessages: Message[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second',
        },
      ];

      const existingSession = ChatSerializationService.serializeMessages(existingMessages);
      const updatedSession = ChatSerializationService.appendMessages(existingSession, newMessages);

      const { messages } = ChatSerializationService.deserializeMessages(updatedSession);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata without changing messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
        },
      ];

      const originalMetadata: IChatMetadata = {
        gitUrl: 'https://github.com/test/repo',
        projectId: '123',
      };

      const session = ChatSerializationService.serializeMessages(messages, originalMetadata);

      const newMetadata: IChatMetadata = {
        gitUrl: 'https://github.com/test/repo',
        gitBranch: 'main',
        projectId: '123',
      };

      const updatedSession = ChatSerializationService.updateMetadata(session, newMetadata, 'Updated Title');

      const result = ChatSerializationService.deserializeMessages(updatedSession);
      expect(result.messages).toHaveLength(1);
      expect(result.metadata?.gitBranch).toBe('main');
      expect(result.description).toBe('Updated Title');
    });
  });

  describe('round-trip integrity', () => {
    it('should maintain data integrity through serialize-deserialize cycle', () => {
      const original: Message[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi!',
          createdAt: new Date('2024-01-02'),
          toolInvocations: [
            {
              toolCallId: 'call-1',
              toolName: 'test',
              args: { key: 'value' },
              state: 'result',
              result: { success: true },
            },
          ],
        },
      ];

      const metadata: IChatMetadata = {
        gitUrl: 'https://github.com/test/repo',
        gitBranch: 'main',
        projectId: '123',
      };

      const serialized = ChatSerializationService.serializeMessages(original, metadata);
      const { messages, metadata: deserializedMetadata } = ChatSerializationService.deserializeMessages(serialized);

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe(original[0].id);
      expect(messages[0].content).toBe(original[0].content);
      expect(messages[1].toolInvocations).toHaveLength(1);
      expect(deserializedMetadata).toEqual(metadata);
    });
  });
});
