import { useEffect, useRef } from 'react';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { MessageType } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';
import { description } from '~/lib/persistence';

// import { extractShellCommands } from '~/lib/utils/shellCommands';

import { getJobConfigFromXdp } from '~/lib/services/jobConfigService';
import { getProjectId } from '~/utils/fileLocks';
import { JobPromotionService } from '~/lib/services/jobPromotionService';

const logger = createScopedLogger('usePipelineConfigResponder');

interface UsePipelineConfigResponderOptions {
  currentProjectId?: string;
}

export function usePipelineConfigResponder({ currentProjectId }: UsePipelineConfigResponderOptions) {
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

    logger.info('Setting up GET_PIPELINE_CONFIG listener');

    const unsubscribe = busRef.current.on(MessageType.GET_PIPELINE_CONFIG, async (payload, message) => {
      try {
        logger.info('Received GET_PIPELINE_CONFIG request');

        /*
         * Extract shell commands and get job config similar to adhoc run flow
         * const stages = extractShellCommands();
         */

        // Extract job parameters dynamically from artifacts
        const jobParams = JobPromotionService.extractJobCreationParams();
        logger.info('Extracted job parameters for pipeline config:', jobParams);

        const stages = ["echo 'Hello World'"];
        const jobConfig = await getJobConfigFromXdp(busRef.current, stages);

        // Build pipeline config response
        const projectName = (description.get() ?? 'project').toLowerCase().split(' ').join('_');
        const codeSourceUrl = `applications/${projectIdRef.current || getProjectId() || 'default-project'}`;

        const pipelineConfig = {
          name: projectName,
          description: description.get() || '',
          projectId: projectIdRef.current || getProjectId() || 'default-project',
          sourceUrl: codeSourceUrl,
          stages,
          imageFromUrl: jobConfig.baseImage || '',
          jobExecutionConfig: {
            jobType: 'SPARK_PYTHON',
            mainApplicationFile: jobParams?.mainApplicationFile || 'local:///app/main.py',
            ...(jobParams?.arguments && { arguments: jobParams.arguments }),
          },
        };

        logger.info('Sending GET_PIPELINE_CONFIG_RESPONSE');

        // Send response back to parent using ref
        busRef.current.sendMessage({
          type: MessageType.GET_PIPELINE_CONFIG_RESPONSE,
          payload: pipelineConfig,
          responseId: message.messageId,
        });
      } catch (error) {
        logger.error('Failed to get pipeline config:', error);

        // Send error response using ref
        busRef.current.sendMessage({
          type: MessageType.ERROR,
          payload: { error: error instanceof Error ? error.message : 'Failed to get pipeline config' },
          responseId: message.messageId,
        });
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        logger.info('Cleaning up GET_PIPELINE_CONFIG listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []); // Empty dependencies - use refs for all values
}
