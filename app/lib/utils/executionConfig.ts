import { extractShellCommands, getLastCompleteShellCommands } from './shellCommands';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('executionConfig');

export interface TemplateConfig {
  jobType: string;
  type: string;
  stages: string[];
  codeSourceUrl: string;
}

// Helper function to get execution configuration based on template
export function getExecutionConfig(template?: { id: string; name: string }): TemplateConfig {
  const extractedCommands = extractShellCommands();

  // Get template-specific defaults
  const getTemplateDefaults = (templateId?: string) => {
    switch (templateId) {
      case 'java-application':
        return {
          jobType: 'SPARK_CONNECT_JAVA_ADHOC',
          type: 'Java',
          codeSourceUrl: 'home/projects',
        };
      case 'python-application':
      default:
        return {
          jobType: 'SPARK_CONNECT_PYTHON_ADHOC',
          type: 'Python',
          codeSourceUrl: 'home/projects',
        };
    }
  };

  const defaults = getTemplateDefaults(template?.id);

  /*
   * Use extracted commands if available, otherwise try to get last complete AI commands.
   * If no commands are found, return empty stages array to trigger LLM prompt.
   */
  let stages = extractedCommands;

  if (stages.length === 0) {
    // Try to get the last complete set of shell commands from AI
    const lastCompleteCommands = getLastCompleteShellCommands();

    if (lastCompleteCommands.length > 0) {
      stages = lastCompleteCommands;
      logger.info('Using last complete AI command set:', {
        commands: lastCompleteCommands,
        templateId: template?.id,
      });
    } else {
      // No commands found - return empty array to trigger LLM prompt
      logger.warn('No install/build commands found. Will prompt LLM to generate them.', {
        templateId: template?.id,
      });
      stages = [];
    }
  } else {
    logger.info('Using extracted commands from latest artifact:', {
      commands: stages,
      templateId: template?.id,
    });
  }

  return {
    jobType: defaults.jobType,
    type: defaults.type,
    stages,
    codeSourceUrl: defaults.codeSourceUrl,
  };
}
