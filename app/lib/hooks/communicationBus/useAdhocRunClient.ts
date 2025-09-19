import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { extractShellCommands } from '~/lib/utils/shellCommands';
import { getEditedJobConfigFromXdp, getJobConfigFromXdp } from '~/lib/services/jobConfigService';
import { getExecutionConfig } from '~/lib/utils/executionConfig';
import type { AdhocRunRequestBody, ExecuteAdhocRunResponse, JobType } from '~/types/jobConfig';

const logger = createScopedLogger('useAdhocRunClient');

export function useAdhocRunClient() {
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
        let stages = localConfig.stages;

        if (isEditAndRun) {
          stages = xdpStages;
        }

        logger.info('Job Config from XDP:', JSON.stringify(jobConfig, null, 2));

        const { jobType = '', codeSourceUrl = '', type = '' } = localConfig || {};

        logger.info(
          'Adhoc Run Execution Config:',
          JSON.stringify(
            {
              selectedTemplate,
              projectId,
              extractedCommands: extractShellCommands(),
              mergedConfig: {
                template: { jobType, type }, // Local template config
                job: { baseImage, dataplaneName, dataplaneId, stages, executionConfig }, // Job config from XDP
                codeSource: `${codeSourceUrl}/${projectId}`, // Combined
              },
            },
            null,
            2,
          ),
        );

        const payload: AdhocRunRequestBody = {
          dataplaneId: Number(dataplaneId) || 0,
          jobType: (jobType as JobType) || 'SPARK_CONNECT_PYTHON_ADHOC',
          description: '',
          name: '',
          executionConfig: {
            jobType: (jobType as JobType) || 'SPARK_CONNECT_PYTHON_ADHOC',
            image: baseImage || 'docker.io/apache/spark:4.0.0',
            imagePullSecrets: (executionConfig as any)?.imagePullSecrets || ['registry-secret'],
            imagePullPolicy: (executionConfig as any)?.imagePullPolicy || 'IfNotPresent',
            codeSource: {
              type: 'MINIO',
              config: {
                url: `${codeSourceUrl}/${projectId}`,
              },
            },
            stages: stages || [],
            type: type || 'Python',
            mode: 'cluster',
            driver: (executionConfig as any)?.driver || { cores: 1, memory: '1g', memoryOverhead: '256m' },
            executor: (executionConfig as any)?.executor || {
              instances: 1,
              cores: 1,
              memory: '512m',
              memoryOverhead: '256m',
            },
            dynamicAllocation: (executionConfig as any)?.dynamicAllocation || {
              enabled: true,
              initialExecutors: 1,
              minExecutors: 1,
              maxExecutors: 2,
            },
            depends: depends || { dataStores: [] },
            sparkConf: (executionConfig as any)?.sparkConfig || {},
            timeToLiveSeconds: (executionConfig as any)?.timeToLiveSeconds ?? null,
          },
        };

        logger.info('Final payload being sent:', JSON.stringify(payload, null, 2));

        const response = await fetch('/api/adhoc-run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const outer = (await response.json()) as { success?: boolean; status?: number; data?: ExecuteAdhocRunResponse };
        const backend = outer?.data as ExecuteAdhocRunResponse | undefined;

        if (!response.ok || !backend?.success) {
          throw new Error(backend?.message || `Execution failed: ${response.status}`);
        }

        toast.success(backend.message || 'Adhoc run executed successfully!');

        // Extract runId from backend response shape: backend.data.id
        const runId = backend.data?.id;

        if (runId !== undefined && runId !== null) {
          logger.info('Using runId from response for log streaming:', {
            dataplaneId,
            runId,
            responseData: backend.data,
          });

          workbenchStore.toggleLogViewer(true, {
            dataplaneId: String(dataplaneId),
            runId: String(runId),
          });
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
