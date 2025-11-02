import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useCommunicationBusChild } from './useCommunicationBusChild';
import { useDataplaneInfo } from '~/lib/hooks/useDataplaneInfo';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { extractShellCommands } from '~/lib/utils/shellCommands';
import { getEditedJobConfigFromXdp, getJobConfigFromXdp } from '~/lib/services/jobConfigService';
import { getExecutionConfig } from '~/lib/utils/executionConfig';
import type { AdhocRunRequestBody, ExecuteAdhocRunResponse, JobType } from '~/types/jobConfig';

const logger = createScopedLogger('useAdhocRunClient');

export interface AdhocRunClientCallbacks {
  onSendMessage?: (message: string) => void;
  onSetChatInput?: (message: string) => void;
}

export function useAdhocRunClient(callbacks?: AdhocRunClientCallbacks) {
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

        // Check if stages are empty - if so, prompt LLM to generate them
        if (!localConfig.stages || localConfig.stages.length === 0) {
          logger.warn('No install/build commands found. Prompting LLM to generate them.');

          /*
           * Message with hidden technical instructions wrapped in boltArtifact tags.
           * The stripMetadata function in UserMessage.tsx removes boltArtifact tags from display,
           * so the user only sees the friendly message, but the LLM sees the full instructions.
           */
          const userMessage = `No install and build commands found for the project you just worked on. Please provide the install and run commands needed to execute this project.

<boltArtifact id="system-instruction" title="Command Format Requirements">
CRITICAL INSTRUCTION FOR AI: You MUST provide the commands wrapped in bolt artifact format with shell actions.

IMPORTANT CONTEXT:
- Analyze the CURRENT project structure and latest changes
- The entry point may have changed (e.g., from job_a to job_b)
- Dependencies may have been added or modified
- ALWAYS provide BOTH install and run commands based on CURRENT state
- The run command must match the LATEST entry point in the project
- Provide ONLY the install command and run command in the exact format above. Do NOT provide explanations or alternatives. Just the commands in bolt artifact format reflecting the CURRENT project state.

Required format:
<boltArtifact id="build-commands" title="Build and Run Commands">
  <boltAction type="shell">
pip install --no-cache-dir -r requirements.txt
  </boltAction>

  <boltAction type="shell">
python3 -m current_app_name
  </boltAction>

  Include auto-run action as instructed when applicable
</boltArtifact>

</boltArtifact>`;

          // Use onSendMessage callback if available to send message to chat
          if (callbacks?.onSendMessage) {
            callbacks.onSendMessage(userMessage);
            toast.info('Requesting build commands from AI...');
          } else {
            // Fallback to just showing a toast if callback not available
            toast.error('No install/build commands found. Please provide commands to build and run the project.');
          }

          setIsExecuting(false);

          return;
        }

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
            imagePullSecrets: (executionConfig as any)?.imagePullSecrets?.length > 0
              ? (executionConfig as any).imagePullSecrets
              : ['registry-ecr-secret'],
            imagePullPolicy: (executionConfig as any)?.imagePullPolicy || 'IfNotPresent',
            codeSource: {
              type: 'MINIO',
              config: {
                url: `${codeSourceUrl}/${projectId}`,
                bucketName: 'aieditor'
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

        const outer = (await response.json()) as {
          success?: boolean;
          status?: number;
          data?: ExecuteAdhocRunResponse;
          error?: string;
        };
        const backend = outer?.data as ExecuteAdhocRunResponse | undefined;

        if (!response.ok || !outer?.success) {
          throw new Error(outer?.error || backend?.message || `Execution failed: ${response.status}`);
        }

        // Use backend message if it's meaningful, otherwise use default
        const successMessage =
          backend?.message && backend.message !== 'SUCCESS' ? backend.message : 'Adhoc run executed successfully!';
        toast.success(successMessage);

        // Extract runId from backend response shape: backend.data.id
        const runId = backend?.data?.id;

        if (runId !== undefined && runId !== null) {
          logger.info('Using runId from response for log streaming:', {
            dataplaneId,
            runId,
            responseData: backend?.data,
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
    [bus, callbacks],
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
  const dataplaneInfo = useDataplaneInfo();

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
          dataplaneInfo,
        });

        // Get job configuration from XDP with the local stages
        const jobConfig = await getJobConfigFromXdp(bus, localConfig.stages);

        pipelineLogger.info('Pipeline Config from XDP:', JSON.stringify(jobConfig, null, 2));

        /**
         * Use dataplane ID from useDataplaneInfo hook (same pattern as Chat component)
         * This gets the dataplane ID directly from the parent iframe
         */
        const dataplaneId = dataplaneInfo?.dataplaneId || '';

        pipelineLogger.info('Using dataplane ID from useDataplaneInfo:', {
          dataplaneId,
          dataplaneInfo,
        });

        // Create the pipeline payload based on user specification
        const payload = {
          dataplaneId: Number(dataplaneId) || 0,
          source: {
            type: 'MINIO',
            config: {
              url: `home/projects/${Number(currentProjectId)}`, // Hardcoded as per user requirement
              bucketName: 'aieditor'
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
          throw new Error(outer?.error || `Build and test pipeline execution failed: ${response.status}`);
        }

        // Use backend message if it's meaningful, otherwise use default
        const successMessage =
          outer.message && outer.message !== 'SUCCESS'
            ? outer.message
            : 'Build and test pipeline triggered successfully!';
        toast.success(successMessage);

        /*
         * Extract pipeline run ID from pipeline response for log streaming
         * Response structure: outer.data.data.id (pipeline run ID)
         */
        const pipelineRunId = outer.data?.data?.id;
        const pipelineId = outer.data?.data?.pipelineId;
        const responseDateplaneId = outer.data?.data?.dataplaneName || String(dataplaneId); // Use dataplaneName from response or fallback to jobConfig dataplaneId

        pipelineLogger.info('Attempting to extract pipeline IDs and dataplaneId:', {
          pipelineRunId,
          pipelineId,
          dataplaneId: responseDateplaneId,
          fullResponseData: outer.data,
          nestedData: outer.data?.data,
        });

        if (pipelineRunId !== undefined && pipelineRunId !== null) {
          pipelineLogger.info('✅ Found pipeline run ID, opening log viewer for pipeline logs:', {
            dataplaneId: responseDateplaneId,
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
            dataplaneId: String(responseDateplaneId),
            runId: String(pipelineRunId),
            isPipeline: true,
            title: `Pipeline Build - ${String(pipelineRunId).substring(0, 8)}`,
          });

          pipelineLogger.info('✅ Log viewer toggle called with config:', {
            dataplaneId: String(responseDateplaneId),
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
        pipelineLogger.error('Execute build and test pipeline error:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to trigger build and test pipeline');
      } finally {
        setIsExecuting(false);
      }
    },
    [bus, dataplaneInfo],
  );

  return {
    isExecuting,
    executePipelineAdhocRun,
  };
}
