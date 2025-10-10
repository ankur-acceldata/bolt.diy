import React from 'react';
import { useStore } from '@nanostores/react';
import { Button } from '~/components/ui/Button';
import { usePipelineAdhocRunClient } from '~/lib/hooks/communicationBus';
import { useSync } from '~/lib/hooks/useSync';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PipelineBuildButton');

interface PipelineBuildButtonProps {
  className?: string;
}

export const PipelineBuildButton: React.FC<PipelineBuildButtonProps> = ({ className }) => {
  const { currentProjectId } = useSync();
  const { isExecuting, executePipelineAdhocRun } = usePipelineAdhocRunClient();
  const isLogStreamActive = useStore(workbenchStore.logStreamActive);

  // Disable when executing, no project ID, or when log stream is actively connecting/streaming
  const isDisabled = isExecuting || !currentProjectId || isLogStreamActive;

  const handleBuildImage = async () => {
    logger.debug('🔧 PipelineBuildButton clicked!', {
      currentProjectId,
      isExecuting,
      isLogStreamActive,
      isDisabled,
    });

    if (isDisabled) {
      logger.warn('Pipeline build disabled due to current state:', {
        isExecuting,
        isLogStreamActive,
        currentProjectId,
      });
      return;
    }

    /*
     * For now, use a default project name or derive it from project ID
     * In a real implementation, you might want to get this from the chat context or store
     */
    const projectName = `project_${currentProjectId}`;

    logger.debug(' Calling executePipelineAdhocRun with:', { currentProjectId, projectName });
    await executePipelineAdhocRun(currentProjectId, projectName);
  };

  return (
    <Button
      onClick={handleBuildImage}
      disabled={isDisabled}
      variant="accent"
      size="sm"
      className={`px-2 py-1 text-sm focus:ring-0 focus:ring-offset-0 bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent hover:opacity-90 border border-bolt-elements-borderColorActive shadow-sm ${className || ''}`}
      title={
        isDisabled
          ? `Disabled: ${
              !currentProjectId
                ? 'No project ID'
                : isExecuting
                  ? 'Pipeline build in progress'
                  : isLogStreamActive
                    ? 'Log stream is active'
                    : 'Unknown reason'
            }`
          : 'Build and test pipeline image'
      }
    >
      {isExecuting ? (
        <div className="i-ph:spinner-gap animate-spin text-bolt-elements-item-contentAccent" />
      ) : (
        <div className="i-ph:hammer text-bolt-elements-item-contentAccent" />
      )}
    </Button>
  );
};
