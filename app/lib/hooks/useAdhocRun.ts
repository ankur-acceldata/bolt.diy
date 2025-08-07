import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useCommunicationBusChild } from '~/lib/hooks';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { extractShellCommands } from '~/lib/utils/shellCommands';
import { getEditedJobConfigFromXdp, getJobConfigFromXdp } from '~/lib/services/jobConfigService';
import { getExecutionConfig } from '~/lib/utils/executionConfig';

const logger = createScopedLogger('useAdhocRun');

export function useAdhocRun() {
  const [isExecuting, setIsExecuting] = useState(false);
  const bus = useCommunicationBusChild();

  const executeAdhocRun = useCallback(
    async (
      isEditAndRun: boolean = false,
      selectedTemplate?: { id: string; name: string },
      currentProjectId?: string,
    ) => {
      if (!currentProjectId) {
        toast.error('Project ID not available. Please wait for sync initialization to complete.');
        return;
      }

      // Use the project ID from sync - no fallback since sync is mandatory
      const projectId = currentProjectId;

      setIsExecuting(true);

      try {
        // Get local execution configuration based on selected template
        const localConfig = getExecutionConfig(selectedTemplate);

        logger.info('Local execution config generated:', {
          template: selectedTemplate,
          extractedCommands: extractShellCommands(),
          localConfig,
        });

        let jobConfig;

        // Get job configuration from XDP with the local stages
        if (!isEditAndRun) {
          jobConfig = await getJobConfigFromXdp(bus, localConfig.stages);
        } else {
          jobConfig = await getEditedJobConfigFromXdp(bus, localConfig.stages);
        }

        /**
         * Destructure for cleaner usage, handling nulls/undefined with defaults
         * Note: We preserve our local stages instead of using stages from XDP
         */
        const {
          baseImage = '',
          dataplaneName = '',
          dataplaneId = '',
          stages: xdpStages = [],
          depends = { dataStores: [] },
          executionConfig = {},
        } = jobConfig || {};

        // Use our local stages instead of XDP stages to preserve extracted commands
        const stages = localConfig.stages;

        logger.info('Job Config from XDP:', JSON.stringify(jobConfig, null, 2));
        logger.info('Stages comparison:', {
          xdpStages,
          localStages: localConfig.stages,
          usingStages: stages,
          stagesSource: 'local (preserving extracted commands)',
        });

        const { adhocRunType = '', codeSourceUrl = '', type = '' } = localConfig || {};

        logger.info('Adhoc Run Execution Config:', {
          selectedTemplate,
          projectId,
          extractedCommands: extractShellCommands(),
          mergedConfig: {
            template: { adhocRunType, type }, // Local template config
            job: { baseImage, dataplaneName, dataplaneId, stages, executionConfig }, // Job config from XDP
            codeSource: `${codeSourceUrl}/${projectId}`, // Combined
          },
        });

        const payload = {
          config: {
            adhocRunType: adhocRunType || '',
            image: baseImage || '',
            codeSource: {
              type: 'MINIO',
              config: {
                url: `${codeSourceUrl}/${projectId}`,
              },
            },
            stages: stages || [],
            type: type || '',
            mode: 'cluster',
            executionConfig: executionConfig || {},
            depends: depends || { dataStores: [] },
          },
          dataplaneName: dataplaneName || '',
          dataplaneId: dataplaneId || '',
        };

        logger.info('Final payload being sent:', JSON.stringify(payload, null, 2));

        const response = await fetch('/api/adhoc-run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = (await response.json()) as {
          error?: string;
          message?: string;
          data?: any;
          success?: boolean;
        };

        if (!response.ok) {
          throw new Error(result.error || `Execution failed: ${response.status}`);
        }

        toast.success(result.message || 'Adhoc run executed successfully!');

        /*
         * Extract information for log streaming
         * Expected format from example: wss://demo.xdp.acceldata.tech/xdp-cp-service/api/dataplane/135/logs/adhoc-run-spar-1753369519227/stream?tailLines=100
         */
        if (result.success && result.data) {
          // Extract pod name and dataplane ID from the API response
          const podName = result.data?.data?.podName || result.data?.name || result.data?.id;

          // const dataplaneId = result.data?.data?.dataplaneId || result.data?.dataplane?.id || result.data?.dataplane;

          logger.info('Extracted from adhoc-run response:', { podName, dataplaneId, responseData: result.data });

          // Open log viewer with extracted parameters and clear any previous logs
          workbenchStore.toggleLogViewer(true, { dataplaneId: String(dataplaneId), podName: String(podName) });
        }
      } catch (error) {
        logger.error('Execute adhoc run error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to execute adhoc run');
      } finally {
        setIsExecuting(false);
      }
    },
    [bus],
  );

  return {
    isExecuting,
    executeAdhocRun,
  };
}
