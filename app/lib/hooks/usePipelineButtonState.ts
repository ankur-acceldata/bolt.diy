import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { useAdhocRunClient, usePipelineAdhocRunClient } from '~/lib/hooks/communicationBus';
import { streamingState } from '~/lib/stores/streaming';

/**
 * Hook to determine if the pipeline build button should be disabled
 * based on various application states
 */
export function usePipelineButtonState() {
  // Get both regular and pipeline adhoc run execution states
  const { isExecuting: isRegularAdhocRunExecuting } = useAdhocRunClient();
  const { isExecuting: isPipelineAdhocRunExecuting } = usePipelineAdhocRunClient();

  // Get AI streaming state
  const isAiStreaming = useStore(streamingState);

  /*
   * Get log viewer state - but be less conservative about "busy"
   * Only consider it busy if there's no config (meaning it's in a transitional state)
   * Once logs are streaming or finished, the viewer is just displaying content
   */
  const showLogViewer = useStore(workbenchStore.showLogViewer);
  const logViewerConfig = useStore(workbenchStore.logViewerConfig);

  /*
   * More conservative approach: only consider busy if viewer is open but no config yet
   * This catches the brief moment between opening and configuration
   */
  const isLogViewerBusy = showLogViewer && logViewerConfig === null;

  return {
    isAdhocRunExecuting: isRegularAdhocRunExecuting || isPipelineAdhocRunExecuting,
    isAiStreaming,
    isLogViewerBusy,
  };
}
