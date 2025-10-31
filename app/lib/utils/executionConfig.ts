import { extractShellCommands, getLastCompleteShellCommands } from './shellCommands';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('executionConfig');

export interface TemplateConfig {
  jobType: string;
  type: string;
  stages: string[];
  fallbackStages: string[];
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
          jobType: 'SPARK_CONNECT_PYTHON_ADHOC',
          type: 'Python',
          fallbackStages: [
            'pip install -r requirements.txt --no-cache-dir',
            'python3 main.py',
            "echo 'Python execution completed successfully'",
          ],
          codeSourceUrl: 'home/projects',
        };
    }
  };

  const defaults = getTemplateDefaults(template?.id);

  /*
   * Use extracted commands if available, otherwise try to get last complete AI commands,
   * and only fall back to hardcoded defaults as a last resort
   */
  let stages = extractedCommands;

  if (stages.length === 0) {
    // Try to get the last complete set of shell commands from AI
    const lastCompleteCommands = getLastCompleteShellCommands();

    if (lastCompleteCommands.length > 0) {
      stages = lastCompleteCommands;
      logger.info('Using last complete AI command set instead of hardcoded fallback:', {
        commands: lastCompleteCommands,
        templateId: template?.id,
      });
    } else {
      // Final fallback to hardcoded defaults
      stages = defaults.fallbackStages;
      logger.warn('No AI commands found, using hardcoded fallback stages:', {
        fallbackStages: defaults.fallbackStages,
        templateId: template?.id,
      });
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
    fallbackStages: defaults.fallbackStages,
    codeSourceUrl: defaults.codeSourceUrl,
  };
}
