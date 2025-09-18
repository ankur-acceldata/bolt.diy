import { useEffect } from 'react';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { MessageType } from '~/types/communicationBus';
import { JobPromotionService, type JobPromotionParams } from '~/lib/services/jobPromotionService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useJobPromotionResponder');

export interface JobPromotionRequest {
  baseImage?: string;
}

export interface JobPromotionResponse {
  success: boolean;
  data?: JobPromotionParams;
  error?: string;
}

/**
 * Hook for handling job promotion functionality via postMessage communication
 */
export function useJobPromotionResponder() {
  const bus = useCommunicationBusChild();

  // Handle PROMOTE_TO_JOB messages from parent
  useEffect(() => {
    const unsubscribe = bus.on(MessageType.PROMOTE_TO_JOB, async (payload, message) => {
      try {
        logger.info('Received PROMOTE_TO_JOB request from parent:', payload);

        // Extract job creation parameters - just the 3 required values
        const jobParams = JobPromotionService.extractJobCreationParams();

        if (!jobParams) {
          // Send error response
          const errorResponse: JobPromotionResponse = {
            success: false,
            error: 'Unable to extract job parameters - no main application file found',
          };

          bus.sendMessage({
            type: MessageType.PROMOTE_TO_JOB_RESPONSE,
            payload: errorResponse,
            responseId: message.messageId,
          });

          return;
        }

        // Send successful response with job parameters
        const successResponse: JobPromotionResponse = {
          success: true,
          data: jobParams,
        };

        logger.info('Sending successful job promotion response:', successResponse);

        bus.sendMessage({
          type: MessageType.PROMOTE_TO_JOB_RESPONSE,
          payload: successResponse,
          responseId: message.messageId,
        });
      } catch (error) {
        logger.error('Error processing PROMOTE_TO_JOB request:', error);

        // Send error response
        const errorResponse: JobPromotionResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };

        bus.sendMessage({
          type: MessageType.PROMOTE_TO_JOB_RESPONSE,
          payload: errorResponse,
          responseId: message.messageId,
        });
      }
    });

    return unsubscribe;
  }, [bus]);
}
