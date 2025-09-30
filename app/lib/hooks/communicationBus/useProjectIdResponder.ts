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
  const isInitializedRef = useRef(false);

  projectIdRef.current = currentProjectId;

  logger.debug('projectIdRef', JSON.stringify(projectIdRef));

  // Immediate setup - don't wait for useEffect
  const setupResponder = () => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    logger.info('Setting up GET_PROJECT_ID responder immediately');

    const unsubscribe = bus.on(MessageType.GET_PROJECT_ID, (_payload, message) => {
      // Use the current project ID from useSync hook first, then fallback to getProjectId()
      const projectId = projectIdRef.current || getProjectId();

      logger.info('Received GET_PROJECT_ID request, projectId candidates:', {
        fromRef: projectIdRef.current,
        fromGetProjectId: getProjectId(),
        finalProjectId: projectId,
      });

      try {
        bus.sendMessage({
          type: MessageType.GET_PROJECT_ID_RESPONSE,
          payload: { projectId },
          responseId: message.messageId,
        });
        logger.info('Successfully sent GET_PROJECT_ID_RESPONSE with projectId:', projectId);
      } catch (error) {
        logger.error('Failed to send GET_PROJECT_ID_RESPONSE:', error);
      }
    });

    unsubscribeRef.current = unsubscribe;

    return unsubscribe;
  };

  // Set up immediately if bus is ready, or set up anyway as fallback
  if (bus.isReady || bus.isConnected) {
    setupResponder();
    logger.info('Project ID responder set up immediately - bus ready');
  } else {
    // Set up anyway - the bus might be functional even if not marked as ready
    logger.warn('Setting up project ID responder even though bus not marked ready');
    setupResponder();
  }

  // Add debugging for the communication bus status
  logger.info('Communication bus status:', {
    isReady: bus.isReady,
    isConnected: bus.isConnected,
    hasCurrentProjectId: !!currentProjectId,
    currentProjectId,
  });

  // Immediately announce project ID to parent if available
  if (currentProjectId && window.parent && window.parent !== window) {
    logger.info('Proactively announcing project ID to parent on initialization:', currentProjectId);

    // Send both READY and a direct GET_PROJECT_ID_RESPONSE
    try {
      // Send READY message
      window.parent.postMessage(
        {
          type: MessageType.READY,
          payload: { hasProjectId: true, projectId: currentProjectId },
          source: 'bolt.diy',
          timestamp: Date.now(),
        },
        '*',
      );

      // Also send a direct GET_PROJECT_ID_RESPONSE for immediate availability
      window.parent.postMessage(
        {
          type: MessageType.GET_PROJECT_ID_RESPONSE,
          payload: { projectId: currentProjectId },
          source: 'bolt.diy',
          timestamp: Date.now(),
        },
        '*',
      );
      logger.info('Sent proactive project ID announcement and response via direct postMessage');
    } catch (error) {
      logger.error('Failed to send direct announcement', error);
    }
  }

  useEffect(() => {
    // Set up direct window message listener as backup - completely independent of the bus
    const handleDirectMessage = (event: MessageEvent) => {
      try {
        const message = event.data;

        if (message && message.type === MessageType.GET_PROJECT_ID && message.messageId) {
          logger.warn('BACKUP: Received direct GET_PROJECT_ID request via window listener');

          // Use the current project ID from useSync hook first, then fallback to getProjectId()
          const projectId = projectIdRef.current || getProjectId();

          logger.info('BACKUP: Direct response to GET_PROJECT_ID with:', projectId);

          // Send response directly via postMessage
          if (window.parent && window.parent !== window) {
            const response = {
              type: MessageType.GET_PROJECT_ID_RESPONSE,
              payload: { projectId },
              responseId: message.messageId,
              source: 'bolt.diy',
              timestamp: Date.now(),
            };

            window.parent.postMessage(response, '*');
            logger.info('BACKUP: Sent direct GET_PROJECT_ID_RESPONSE via window.parent.postMessage');
          }
        }
      } catch (error) {
        logger.error('Error in direct message handler:', error);
      }
    };

    window.addEventListener('message', handleDirectMessage);
    logger.info('Direct window message listener set up as backup');

    // Only set up if not already set up and bus is ready
    if (!unsubscribeRef.current && (bus.isReady || bus.isConnected)) {
      setupResponder();
      isInitializedRef.current = true;
      logger.info('Project ID responder initialized via useEffect');

      // Proactively announce readiness to parent if we have a project ID
      if (projectIdRef.current) {
        logger.debug('Announcing project ID availability to parent');

        try {
          bus.sendMessage({
            type: MessageType.READY,
            payload: { hasProjectId: true, projectId: projectIdRef.current },
          });
        } catch (error) {
          logger.warn('Failed to announce project ID readiness', error);
        }
      }
    } else if (!bus.isReady && !bus.isConnected) {
      logger.debug('Communication bus not ready, waiting...');
    }

    return () => {
      window.removeEventListener('message', handleDirectMessage);

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      isInitializedRef.current = false;
    };
  }, [bus, bus.isReady, bus.isConnected]);

  // Log current state for debugging
  useEffect(() => {
    if (isInitializedRef.current) {
      logger.debug('Project ID responder state:', {
        currentProjectId: projectIdRef.current,
        busReady: bus.isReady,
        busConnected: bus.isConnected,
      });
    }
  }, [currentProjectId, bus.isReady, bus.isConnected]);
}
