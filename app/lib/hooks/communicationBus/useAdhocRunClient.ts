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
            image: baseImage || '191579300362.dkr.ecr.us-east-1.amazonaws.com/acceldata/xdp/dp/spark:4.0.0-sc',
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
            runConf: {
              IS_BOLT: 'true',
            },
          } as AdhocRunRequestBody['executionConfig'],
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

          // Create a new log viewer instance for this adhoc run
          workbenchStore.createLogViewerInstance({
            dataplaneId: String(dataplaneId),
            runId: String(runId),
            isPipeline: false,
            title: `Adhoc Run - ${String(runId).substring(0, 8)}`,
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

const pipelineLogger = createScopedLogger('usePipelineAdhocRunClient');

export function usePipelineAdhocRunClient() {
  const [isExecuting, setIsExecuting] = useState(false);
  const bus = useCommunicationBusChild();

  const executePipelineAdhocRun = useCallback(
    async (currentProjectId?: string, currentProjectName?: string) => {
      if (!currentProjectId) {
        toast.error('Project ID not available. Please wait for sync initialization to complete.');
        return;
      }

      setIsExecuting(true);

      try {
        // Get local execution configuration for pipeline template
        const localConfig = getExecutionConfig({ id: 'pipeline', name: 'Pipeline Build' });

        pipelineLogger.info('Pipeline execution config generated:', {
          projectId: currentProjectId,
          projectName: currentProjectName,
          localConfig,
        });

        // Get job configuration from XDP with the local stages
        const jobConfig = await getJobConfigFromXdp(bus, localConfig.stages);

        pipelineLogger.info('Pipeline Config from XDP:', JSON.stringify(jobConfig, null, 2));

        // Create the pipeline payload based on user specification
        const payload = {
          dataplaneId: 27, // Hardcoded as per user requirement
          source: {
            type: 'MINIO',
            config: {
              url: `home/projects/${Number(currentProjectId)}`, // Hardcoded as per user requirement
              additionalParams: null,
            },
          },
          projectId: Number(currentProjectId),
          image: {
            from: {
              url: '191579300362.dkr.ecr.us-east-1.amazonaws.com/acceldata/xdp/dp/spark-dind:1.0.0-1759124717090', // Hardcoded as per user requirement
            },
            to: {
              url: currentProjectName ? `${currentProjectName}_${currentProjectId}` : `pipeline_${currentProjectId}`,
            },
          },
          enabled: true,
        };

        pipelineLogger.info('Pipeline payload being sent:', JSON.stringify(payload, null, 2));

        const response = await fetch('/api/pipeline-adhoc-run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        pipelineLogger.info('Pipeline API response status:', response.status);

        const outer = (await response.json()) as {
          success?: boolean;
          status?: number;
          data?: any;
          error?: string;
          message?: string;
        };

        pipelineLogger.info('Pipeline API response data:', JSON.stringify(outer, null, 2));

        if (!response.ok || !outer?.success) {
          throw new Error(outer?.error || `Pipeline execution failed: ${response.status}`);
        }

        toast.success(outer.message || 'Pipeline adhoc run executed successfully!');

        /*
         * Extract pipeline run ID from pipeline response for log streaming
         * Response structure: outer.data.data.id (pipeline run ID)
         */
        const pipelineRunId = outer.data?.data?.id;
        const pipelineId = outer.data?.data?.pipelineId;
        const dataplaneId = outer.data?.data?.dataplaneName || '27'; // Use dataplaneName or fallback to hardcoded value

        pipelineLogger.info('Attempting to extract pipeline IDs and dataplaneId:', {
          pipelineRunId,
          pipelineId,
          dataplaneId,
          fullResponseData: outer.data,
          nestedData: outer.data?.data,
        });

        if (pipelineRunId !== undefined && pipelineRunId !== null) {
          pipelineLogger.info('✅ Found pipeline run ID, opening log viewer for pipeline logs:', {
            dataplaneId,
            pipelineRunId,
            pipelineId,
            responseData: outer.data?.data,
          });

          /*
           * Open log viewer for pipeline logs using the pipeline log stream endpoint
           * Note: We need to determine what ID the pipeline log endpoint expects
           */
          // Create a new log viewer instance for this pipeline build
          workbenchStore.createLogViewerInstance({
            dataplaneId: String(dataplaneId),
            runId: String(pipelineRunId),
            isPipeline: true,
            title: `Pipeline Build - ${String(pipelineRunId).substring(0, 8)}`,
          });

          pipelineLogger.info('✅ Log viewer toggle called with config:', {
            dataplaneId: String(dataplaneId),
            runId: String(pipelineRunId),
            isPipeline: true,
          });
        } else {
          pipelineLogger.error(
            '❌ No pipeline run ID found in pipeline response, cannot open log viewer. Full response:',
            {
              outer,
              dataPath: outer.data,
              nestedDataPath: outer.data?.data,
            },
          );
        }
      } catch (error) {
        pipelineLogger.error('Execute pipeline adhoc run error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to execute pipeline adhoc run');
      } finally {
        setIsExecuting(false);
      }
    },
    [bus],
  );

  return {
    isExecuting,
    executePipelineAdhocRun,
  };
}
