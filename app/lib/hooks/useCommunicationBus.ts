import { useEffect, useRef, useCallback } from 'react';
import { PostMessageService } from '~/lib/services/postMessageService';
import { MessageType } from '~/types/communicationBus';
import type { BusMessage, MessageHandler, CommunicationBusConfig } from '~/types/communicationBus';

/**
 * Simple communication bus hook for iframe child applications
 * Automatically sets up the connection and announces readiness to parent
 */
export function useCommunicationBusChild(config?: CommunicationBusConfig) {
  const serviceRef = useRef<PostMessageService | null>(null);

  useEffect(() => {
    // Initialize service
    serviceRef.current = new PostMessageService(config);

    // Set ready immediately for iframe child and announce to parent
    serviceRef.current.setReady();
    serviceRef.current.sendMessage({ type: MessageType.READY });

    return () => {
      serviceRef.current?.destroy();
    };
  }, []);

  const on = useCallback(<T = any>(type: string, handler: MessageHandler<T>) => {
    return (
      serviceRef.current?.on(type, handler) ||
      (() => {
        // Empty unsubscribe function
      })
    );
  }, []);

  const off = useCallback((type: string, handler?: MessageHandler) => {
    serviceRef.current?.off(type, handler);
  }, []);

  const sendMessage = useCallback(<T = any>(message: Partial<BusMessage<T>>) => {
    return serviceRef.current?.sendMessage(message);
  }, []);

  const sendMessageWithResponse = useCallback(
    async <T = any, R = any>(
      message: Partial<BusMessage<T>>,
      options?: {
        timeout?: number;
        responseType?: string;
      },
    ): Promise<R> => {
      if (!serviceRef.current) {
        throw new Error('Communication service not initialized');
      }

      return serviceRef.current.sendMessageWithResponse<T, R>(message, options);
    },
    [],
  );

  const getMessageHistory = useCallback(() => {
    return serviceRef.current?.getMessageHistory() || [];
  }, []);

  const getPendingResponsesInfo = useCallback(() => {
    return serviceRef.current?.getPendingResponsesInfo() || { pendingMessageIds: [], pendingResponseTypes: {} };
  }, []);

  return {
    on,
    off,
    sendMessage,
    sendMessageWithResponse,
    isReady: serviceRef.current?.isReady || false,
    isConnected: serviceRef.current?.isConnected || false,
    status: serviceRef.current?.getStatus() || {
      isConnected: false,
      isReady: false,
      messagesSent: 0,
      messagesReceived: 0,
      pendingResponses: 0,
      queuedMessages: 0,
    },

    // Debug methods
    getMessageHistory,
    getPendingResponsesInfo,
  };
}
