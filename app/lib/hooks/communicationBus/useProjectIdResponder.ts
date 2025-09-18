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
  const unsubscribeRef = useRef<(() => void) | null>(null);

  projectIdRef.current = currentProjectId;

  logger.debug('projectIdRef', JSON.stringify(projectIdRef));

  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = bus.on(MessageType.GET_PROJECT_ID, (_payload, message) => {
      const projectId = projectIdRef.current || getProjectId() || 'default-project';

      logger.info('Received GET_PROJECT_ID request', projectId);

      bus.sendMessage({
        type: MessageType.GET_PROJECT_ID_RESPONSE,
        payload: { projectId },
        responseId: message.messageId,
      });
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [bus]);
}
