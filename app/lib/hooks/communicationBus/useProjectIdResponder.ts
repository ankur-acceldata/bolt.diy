import { useEffect, useRef } from 'react';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { MessageType } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';
import { getProjectId } from '~/utils/fileLocks';

interface UseProjectIdResponderOptions {
  currentProjectId?: string;
}

const logger = createScopedLogger('useProjectIdResponder');

export function useProjectIdResponder({ currentProjectId }: UseProjectIdResponderOptions) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);
  const busRef = useRef(bus);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update refs when values change - doesn't trigger re-renders
  useEffect(() => {
    busRef.current = bus;
    projectIdRef.current = currentProjectId;
  }, [bus, currentProjectId]);

  useEffect(() => {
    // Clean up previous listener if it exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    logger.info('Setting up GET_PROJECT_ID listener');

    const unsubscribe = busRef.current.on(MessageType.GET_PROJECT_ID, (_payload, message) => {
      // Use the current project ID from ref first, then fallback to getProjectId()
      const projectId = projectIdRef.current || getProjectId();

      logger.info('Received GET_PROJECT_ID request, responding with projectId:', projectId);

      try {
        busRef.current.sendMessage({
          type: MessageType.GET_PROJECT_ID_RESPONSE,
          payload: { projectId },
          responseId: message.messageId,
        });
        logger.info('Successfully sent GET_PROJECT_ID_RESPONSE');
      } catch (error) {
        logger.error('Failed to send GET_PROJECT_ID_RESPONSE:', error);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        logger.info('Cleaning up GET_PROJECT_ID listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []); // Empty dependencies - use refs for all values
}
