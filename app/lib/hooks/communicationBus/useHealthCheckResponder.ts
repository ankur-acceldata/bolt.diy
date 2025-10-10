import { useEffect, useRef } from 'react';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { MessageType } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useHealthCheckResponder');

/**
 * Responds to health check messages from parent to prevent
 * iframe freezing after idle periods.
 *
 * IMPORTANT: This must be integrated at the app level to ensure
 * health checks work for all features (pipeline, dataplane, adhoc runs, etc.)
 *
 * Handles two types of health check messages:
 * 1. HEARTBEAT - Automatic heartbeat sent every 30s by parent to keep iframe alive
 * 2. WAKE_UP - Explicit wake-up handshake before critical requests
 */
export function useHealthCheckResponder() {
  const bus = useCommunicationBusChild();
  const busRef = useRef(bus);
  const heartbeatUnsubscribeRef = useRef<(() => void) | null>(null);
  const wakeUpUnsubscribeRef = useRef<(() => void) | null>(null);

  // Update ref when bus changes - doesn't trigger re-renders
  useEffect(() => {
    busRef.current = bus;
  }, [bus]);

  useEffect(() => {
    logger.info('Registering health check handlers');

    // Clean up previous listeners if they exist
    if (heartbeatUnsubscribeRef.current) {
      heartbeatUnsubscribeRef.current();
    }

    if (wakeUpUnsubscribeRef.current) {
      wakeUpUnsubscribeRef.current();
    }

    /*
     * Handler for HEARTBEAT (automatic, every 30s)
     * This prevents Chrome from freezing the iframe during idle periods
     */
    const heartbeatUnsubscribe = busRef.current.on(MessageType.HEARTBEAT, (_payload, message) => {
      logger.info('HEARTBEAT received from parent');

      try {
        busRef.current.sendMessage({
          type: MessageType.HEARTBEAT,
          responseId: message.messageId,
          timestamp: Date.now(),
        });
        logger.debug('HEARTBEAT response sent to parent');
      } catch (error) {
        logger.error('Failed to send HEARTBEAT response:', error);
      }
    });

    /*
     * Handler for WAKE_UP (explicit wake-up before critical requests)
     * This ensures iframe is fully responsive before important operations
     */
    const wakeUpUnsubscribe = busRef.current.on(MessageType.WAKE_UP, (_payload, message) => {
      logger.info('WAKE_UP received from parent - iframe is now fully active');

      try {
        busRef.current.sendMessage({
          type: MessageType.WAKE_UP_RESPONSE,
          timestamp: Date.now(),
          payload: { status: 'ready' },
          responseId: message.messageId,
        });
        logger.debug('WAKE_UP_RESPONSE sent to parent');
      } catch (error) {
        logger.error('Failed to send WAKE_UP_RESPONSE:', error);
      }
    });

    heartbeatUnsubscribeRef.current = heartbeatUnsubscribe;
    wakeUpUnsubscribeRef.current = wakeUpUnsubscribe;

    return () => {
      logger.info('Cleaning up health check handlers');

      if (heartbeatUnsubscribeRef.current) {
        heartbeatUnsubscribeRef.current();
        heartbeatUnsubscribeRef.current = null;
      }

      if (wakeUpUnsubscribeRef.current) {
        wakeUpUnsubscribeRef.current();
        wakeUpUnsubscribeRef.current = null;
      }
    };
  }, []); // Empty dependencies - use refs for all values
}
