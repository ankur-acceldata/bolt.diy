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
    console.log('🔧 PipelineBuildButton clicked!', {
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

    console.log('🔧 Calling executePipelineAdhocRun with:', { currentProjectId, projectName });
    await executePipelineAdhocRun(currentProjectId, projectName);
  };

  return (
    <div className={`flex items-center justify-between py-3 px-1 ${className || ''}`}>
      {/* <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-bolt-elements-textSecondary">Pipeline Actions:</span>
          <div className="flex items-center gap-2">
            <div className="i-ph:gear-six text-bolt-elements-textSecondary w-4 h-4" />
            <span className="text-xs text-bolt-elements-textSecondary">Test and Build Image</span>
          </div>
        </div>
      </div> */}

      <div className="flex items-center gap-2 shrink-0">
        <Button
          onClick={handleBuildImage}
          disabled={isDisabled}
          variant="accent"
          size="sm"
          className="px-3 py-1.5 text-sm focus:ring-0 focus:ring-offset-0 bg-bolt-elements-item-backgroundAccent hover:bg-bolt-elements-item-backgroundAccent hover:opacity-90 border border-bolt-elements-borderColorActive shadow-sm"
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
            <>
              <div className="i-ph:spinner-gap animate-spin w-4 h-4 mr-2" />
              Building...
            </>
          ) : (
            <>
              <div className="i-ph:hammer w-4 h-4 mr-2" />
              Test & Build Image
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
