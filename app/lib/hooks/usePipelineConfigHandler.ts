import { useEffect, useRef } from 'react';
import { useCommunicationBusChild } from '~/lib/hooks';
import { MessageType } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';
import { description } from '~/lib/persistence';
import { extractShellCommands } from '~/lib/utils/shellCommands';
import { getJobConfigFromXdp } from '~/lib/services/jobConfigService';

const logger = createScopedLogger('usePipelineConfigHandler');

interface UsePipelineConfigHandlerProps {
  currentProjectId?: string;
}

export function usePipelineConfigHandler({ currentProjectId }: UsePipelineConfigHandlerProps) {
  const bus = useCommunicationBusChild();
  const projectIdRef = useRef(currentProjectId);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Update ref when currentProjectId changes
  projectIdRef.current = currentProjectId;

  useEffect(() => {
    // Clean up previous listener if it exists
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    logger.info('Setting up GET_PIPELINE_CONFIG listener');

    const unsubscribe = bus.on(MessageType.GET_PIPELINE_CONFIG, async (payload, message) => {
      try {
        logger.info('Received GET_PIPELINE_CONFIG request');

        // Extract shell commands and get job config similar to adhoc run flow
        const stages = extractShellCommands();
        const jobConfig = await getJobConfigFromXdp(bus, stages);

        // Build pipeline config response
        const projectName = (description.get() ?? 'project').toLowerCase().split(' ').join('_');
        const codeSourceUrl = `applications/${projectIdRef.current || 'default-project'}`;

        const pipelineConfig = {
          name: projectName,
          sourceUrl: codeSourceUrl,
          stages,
          imageFromUrl: jobConfig.baseImage || '',
        };

        logger.info('Sending GET_PIPELINE_CONFIG_RESPONSE');

        // Send response back to parent
        bus.sendMessage({
          type: MessageType.GET_PIPELINE_CONFIG_RESPONSE,
          payload: pipelineConfig,
          responseId: message.messageId,
        });
      } catch (error) {
        logger.error('Failed to get pipeline config:', error);

        // Send error response
        bus.sendMessage({
          type: MessageType.ERROR,
          payload: { error: error instanceof Error ? error.message : 'Failed to get pipeline config' },
          responseId: message.messageId,
        });
      }
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [bus]); // Only depend on bus, use ref for currentProjectId
}
