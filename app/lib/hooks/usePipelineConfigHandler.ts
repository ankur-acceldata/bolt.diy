import { useEffect } from 'react';
import { useCommunicationBusChild } from '~/lib/hooks';
import { MessageType } from '~/types/communicationBus';
import { createScopedLogger } from '~/utils/logger';
import { description } from '~/lib/persistence';

const logger = createScopedLogger('usePipelineConfigHandler');

interface UsePipelineConfigHandlerProps {
  extractShellCommands: () => string[];
  getJobConfigFromXdp: (stages: string[]) => Promise<any>;
  currentProjectId?: string;
}

export function usePipelineConfigHandler({
  extractShellCommands,
  getJobConfigFromXdp,
  currentProjectId,
}: UsePipelineConfigHandlerProps) {
  const bus = useCommunicationBusChild();

  useEffect(() => {
    const unsubscribe = bus.on(MessageType.GET_PIPELINE_CONFIG, async (payload, message) => {
      try {
        logger.info('Received GET_PIPELINE_CONFIG request:', payload);

        // Extract shell commands and get job config similar to adhoc run flow
        const stages = extractShellCommands();
        const jobConfig = await getJobConfigFromXdp(stages);

        // Build pipeline config response
        const projectName = (description.get() ?? 'project').toLowerCase().split(' ').join('_');
        const codeSourceUrl = `applications/${currentProjectId || 'default-project'}`;

        const pipelineConfig = {
          name: projectName,
          sourceUrl: codeSourceUrl,
          stages,
          imageFromUrl: jobConfig.baseImage || '',
        };

        logger.info('Sending GET_PIPELINE_CONFIG_RESPONSE:', pipelineConfig);

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

    return unsubscribe;
  }, [bus, extractShellCommands, getJobConfigFromXdp, currentProjectId]);
}
