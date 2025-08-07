import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { useCommunicationBusChild } from '~/lib/hooks';
import { MessageType } from '~/types/communicationBus';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import type { JobConfig } from '~/types/jobConfig';

const logger = createScopedLogger('useAdhocRun');

interface TemplateConfig {
  adhocRunType: string;
  type: string;
  stages: string[];
  fallbackStages: string[];
  codeSourceUrl: string;
}

export function useAdhocRun() {
  const [isExecuting, setIsExecuting] = useState(false);
  const bus = useCommunicationBusChild();

  /**
   * Helper function to extract shell commands from bolt actions
   * Only extracts commands from the latest AI message artifact
   */
  const extractShellCommands = useCallback(() => {
    const artifacts = workbenchStore.artifacts.get();
    const artifactIdList = workbenchStore.artifactIdList;
    const shellCommands: string[] = [];

    logger.info('DEBUG: Starting shell command extraction:', {
      artifactIdListLength: artifactIdList.length,
      artifactIds: artifactIdList,
      totalArtifacts: Object.keys(artifacts).length,
    });

    // If no artifacts, return empty array
    if (artifactIdList.length === 0) {
      logger.warn('No artifacts available for command extraction - artifactIdList is empty');
      return shellCommands;
    }

    // Get the latest artifact messageId (most recent)
    const latestMessageId = artifactIdList[artifactIdList.length - 1];
    const latestArtifact = artifacts[latestMessageId];

    if (!latestArtifact) {
      logger.error('Latest artifact not found for messageId:', latestMessageId, {
        availableArtifacts: Object.keys(artifacts),
        artifactIdList,
      });
      return shellCommands;
    }

    logger.info('Extracting commands from latest AI message artifact:', {
      messageId: latestMessageId,
      artifactTitle: latestArtifact.title,
      totalArtifacts: artifactIdList.length,
    });

    // Extract shell commands only from the latest artifact
    const actions = latestArtifact.runner.actions.get();
    const actionCount = Object.keys(actions).length;

    logger.info('DEBUG: Actions in latest artifact:', {
      actionCount,
      actionIds: Object.keys(actions),
      actionTypes: Object.values(actions).map((a) => a.type),
    });

    if (actionCount === 0) {
      logger.warn('No actions found in latest artifact');
      return shellCommands;
    }

    Object.values(actions).forEach((action, index) => {
      logger.info(`DEBUG: Processing action ${index}:`, {
        actionType: action.type,
        hasContent: !!action.content,
        contentPreview: action.content ? action.content.substring(0, 100) + '...' : 'No content',
      });

      if (action.type === 'shell' && action.content) {
        // Split multiline commands and filter out empty lines
        const commands = action.content
          .split('\n')
          .map((cmd) => cmd.trim())
          .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'));

        logger.info('Extracted shell commands from latest message:', {
          messageId: latestMessageId,
          commands,
        });

        shellCommands.push(...commands);
      }
    });

    logger.info('Final extracted commands for job execution:', {
      totalCommands: shellCommands.length,
      commands: shellCommands,
    });

    return shellCommands;
  }, []);

  const getEditedJobConfigFromXdp = useCallback(
    async (stages: string[]): Promise<JobConfig> => {
      const response = await bus.sendMessageWithResponse<{ stages: string[] }, JobConfig[] | JobConfig>(
        {
          type: MessageType.ADHOC_RUN,
          payload: {
            stages,
          },
        },
        {
          responseType: MessageType.ADHOC_RUN_RESPONSE,
          timeout: 100000,
        },
      );

      // Handle both array and single object responses
      if (Array.isArray(response)) {
        if (response.length === 0) {
          throw new Error('No job configuration received from XDP');
        }

        return response[0]; // Return the first (and likely only) JobConfig object
      }

      return response; // Return the single JobConfig object
    },
    [bus],
  );

  const getJobConfigFromXdp = useCallback(
    async (stages: string[]): Promise<JobConfig> => {
      const response = await bus.sendMessageWithResponse<{ stages: string[] }, JobConfig[] | JobConfig>(
        {
          type: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
          payload: {
            stages,
          },
        },
        {
          responseType: MessageType.GET_DEFAULT_ADHOC_RUN_CONFIG,
          timeout: 100000,
        },
      );

      // Handle both array and single object responses
      if (Array.isArray(response)) {
        if (response.length === 0) {
          throw new Error('No job configuration received from XDP');
        }

        return response[0]; // Return the first (and likely only) JobConfig object
      }

      return response; // Return the single JobConfig object
    },
    [bus],
  );

  // Helper function to get execution configuration based on template
  const getExecutionConfig = useCallback(
    (template?: { id: string; name: string }): TemplateConfig => {
      const extractedCommands = extractShellCommands();

      // Get template-specific defaults
      const getTemplateDefaults = (templateId?: string) => {
        switch (templateId) {
          case 'java-application':
            return {
              adhocRunType: 'SPARK_JAVA_ADHOC_RUN',
              type: 'Java',
              fallbackStages: [
                'mvn clean compile',
                'mvn exec:java -Dexec.mainClass="Main"',
                "echo 'Java execution completed successfully'",
              ],
              codeSourceUrl: 'home/projects',
            };
          case 'python-application':
          default:
            return {
              adhocRunType: 'SPARK_PYTHON_ADHOC_RUN',
              type: 'Python',
              fallbackStages: [
                'pip install -r requirements.txt --no-cache-dir',
                'python3 success_test.py',
                "echo 'Python execution completed successfully'",
              ],
              codeSourceUrl: 'home/projects',
            };
        }
      };

      const defaults = getTemplateDefaults(template?.id);

      // Use extracted commands if available, otherwise fall back to template defaults
      const stages = extractedCommands.length > 0 ? extractedCommands : defaults.fallbackStages;

      return {
        adhocRunType: defaults.adhocRunType,
        type: defaults.type,
        stages,
        fallbackStages: defaults.fallbackStages,
        codeSourceUrl: defaults.codeSourceUrl,
      };
    },
    [extractShellCommands],
  );

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
          jobConfig = await getJobConfigFromXdp(localConfig.stages);
        } else {
          jobConfig = await getEditedJobConfigFromXdp(localConfig.stages);
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
    [getExecutionConfig, getJobConfigFromXdp, getEditedJobConfigFromXdp, extractShellCommands],
  );

  return {
    isExecuting,
    executeAdhocRun,
    extractShellCommands,
    getJobConfigFromXdp,
    getEditedJobConfigFromXdp,
  };
}
