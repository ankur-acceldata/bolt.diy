import { MessageType } from '~/types/communicationBus';
import type { BusMessage, MessageHandler, CommunicationBusConfig, BusStatus } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';

/**
 * PostMessageService - Simple communication bus for iframe-parent communication
 */
export class PostMessageService {
  private _handlers: Map<string, MessageHandler[]> = new Map();
  private _pendingResponses: Map<string, (response: any) => void> = new Map();
  private _pendingResponseTypes: Map<string, string> = new Map();
  private _isReady: boolean = false;
  private _isConnected: boolean = false;
  private _config: Required<CommunicationBusConfig>;
  private _messageQueue: BusMessage[] = [];
  private _status: BusStatus;
  private _messageHistory: BusMessage[] = [];
  private _logger = createScopedLogger('PostMessageService');

  constructor(config: CommunicationBusConfig = {}) {
    this._config = {
      debug: false,
      logLevel: 'error',
      timeout: 30000,
      targetOrigin: '*',
      messageQueueSize: 100,
      ...config,
    };

    this._status = {
      isConnected: false,
      isReady: false,
      messagesSent: 0,
      messagesReceived: 0,
      pendingResponses: 0,
      queuedMessages: 0,
    };

    this._setupMessageListener();
  }

  private _log(level: 'error' | 'warn' | 'info', ...args: any[]) {
    if (this._config.logLevel === 'error' && level !== 'error') {
      return;
    }

    if (this._config.logLevel === 'warn' && !['error', 'warn'].includes(level)) {
      return;
    }

    this._logger[level](...args);
  }

  private _setupMessageListener() {
    window.addEventListener('message', this._handleMessage);
  }

  private _isValidBusMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      return false;
    }

    // Accept known message types
    const knownTypes = Object.values(MessageType);

    if (knownTypes.includes(message.type)) {
      return true;
    }

    // Accept messages with explicit source
    return message.source === 'bolt.diy' || message.source === 'parent';
  }

  private _handleMessage = (event: MessageEvent) => {
    const message = event.data as BusMessage;

    if (!this._isValidBusMessage(message)) {
      return;
    }

    this._status.messagesReceived++;

    // Store message in history for debugging (keep last 50 messages)
    this._messageHistory.push(message);

    if (this._messageHistory.length > 50) {
      this._messageHistory.shift();
    }

    // Handle system messages
    switch (message.type) {
      case MessageType.READY:
        this._handleReady(message);
        return;
      case MessageType.HEARTBEAT:
        this._handleHeartbeat(message);
        return;
    }

    // Handle response messages
    if (message.responseId && this._pendingResponses.has(message.responseId)) {
      const expectedResponseType = this._pendingResponseTypes.get(message.responseId);

      // Validate response type if one was specified
      if (expectedResponseType && message.type !== expectedResponseType) {
        this._log(
          'warn',
          `Response type mismatch for messageId ${message.responseId}: expected ${expectedResponseType}, got ${message.type}. Message:`,
          message,
        );

        // Continue processing anyway for backward compatibility
      }

      const handler = this._pendingResponses.get(message.responseId)!;
      handler(message.payload);
      this._pendingResponses.delete(message.responseId);
      this._pendingResponseTypes.delete(message.responseId);
      this._status.pendingResponses--;

      return;
    }

    // Handle regular messages
    this._dispatchMessage(message);
  };

  private _handleReady(message: BusMessage) {
    this._isReady = true;
    this._isConnected = true;
    this._status.isReady = true;
    this._status.isConnected = true;
    this._log('info', 'Connection ready');
    this._flushMessageQueue();
    this._dispatchMessage(message);
  }

  private _handleHeartbeat(message: BusMessage) {
    // Only respond to heartbeats, not responses (prevents infinite loops)
    if (!message.responseId) {
      this.sendMessage({ type: MessageType.HEARTBEAT, responseId: message.messageId });
    }
  }

  private _dispatchMessage(message: BusMessage) {
    const handlers = this._handlers.get(message.type);

    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.payload, message);
        } catch (error) {
          this._log('error', `Handler error for ${message.type}:`, error);
        }
      });
    }
  }

  private _flushMessageQueue() {
    while (this._messageQueue.length > 0) {
      const message = this._messageQueue.shift();

      if (message) {
        this._sendMessageInternal(message);
      }
    }
    this._status.queuedMessages = 0;
  }

  private _sendMessageInternal(message: BusMessage) {
    this._status.messagesSent++;

    if (window.parent && window.parent !== window) {
      // Send from iframe to parent
      window.parent.postMessage(message, this._config.targetOrigin);
    } else {
      this._log('warn', 'No parent window available');
    }
  }

  private _generateMessageId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API
  on<T = any>(type: string, handler: MessageHandler<T>): () => void {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, []);
    }

    this._handlers.get(type)!.push(handler);

    return () => {
      const handlers = this._handlers.get(type);

      if (handlers) {
        const index = handlers.indexOf(handler);

        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  off(type: string, handler?: MessageHandler) {
    if (!handler) {
      this._handlers.delete(type);
    } else {
      const handlers = this._handlers.get(type);

      if (handlers) {
        const index = handlers.indexOf(handler);

        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  sendMessage<T = any>(message: Partial<BusMessage<T>>): string {
    const fullMessage: BusMessage<T> = {
      ...message,
      type: message.type!,
      timestamp: Date.now(),
      messageId: message.messageId || this._generateMessageId(),
      source: 'bolt.diy',
    };

    // Queue message if not ready
    if (!this._isReady && fullMessage.type !== MessageType.READY) {
      if (this._messageQueue.length >= this._config.messageQueueSize) {
        this._messageQueue.shift();
        this._log('warn', 'Message queue full, dropping oldest message');
      }

      this._messageQueue.push(fullMessage);
      this._status.queuedMessages = this._messageQueue.length;

      return fullMessage.messageId!;
    }

    this._sendMessageInternal(fullMessage);

    return fullMessage.messageId!;
  }

  async sendMessageWithResponse<T = any, R = any>(
    message: Partial<BusMessage<T>>,
    options?: {
      timeout?: number;
      responseType?: string;
    },
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const messageId = this.sendMessage(message);
      const timeoutMs = options?.timeout || this._config.timeout;
      const expectedResponseType = options?.responseType || message.type;

      const timeoutHandle = setTimeout(() => {
        this._pendingResponses.delete(messageId);
        this._pendingResponseTypes.delete(messageId);
        this._status.pendingResponses--;
        this._log('error', `Message timeout: ${message.type} (${timeoutMs}ms)`);
        reject(new Error(`Message timeout: ${message.type} (${timeoutMs}ms)`));
      }, timeoutMs);

      this._pendingResponses.set(messageId, (response: R) => {
        clearTimeout(timeoutHandle);
        this._status.pendingResponses--;
        resolve(response);
      });

      // Store expected response type for validation
      this._pendingResponseTypes.set(messageId, expectedResponseType!);

      // Removed verbose logging for production

      this._status.pendingResponses++;
    });
  }

  setReady() {
    this._isReady = true;
    this._isConnected = true;
    this._status.isReady = true;
    this._status.isConnected = true;
    this._log('info', 'Connection set to ready state');
    this._flushMessageQueue();
  }

  getStatus(): BusStatus {
    return { ...this._status };
  }

  // Debug method to get message history
  getMessageHistory(): BusMessage[] {
    return [...this._messageHistory];
  }

  // Debug method to get pending responses info
  getPendingResponsesInfo() {
    return {
      pendingMessageIds: Array.from(this._pendingResponses.keys()),
      pendingResponseTypes: Object.fromEntries(this._pendingResponseTypes),
    };
  }

  get isReady(): boolean {
    return this._isReady;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  destroy() {
    window.removeEventListener('message', this._handleMessage);
    this._handlers.clear();
    this._pendingResponses.clear();
    this._pendingResponseTypes.clear();
    this._messageQueue = [];
    this._isReady = false;
    this._isConnected = false;
  }
}
