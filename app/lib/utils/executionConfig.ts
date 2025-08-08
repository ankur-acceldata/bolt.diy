import { extractShellCommands } from './shellCommands';

export interface TemplateConfig {
  adhocRunType: string;
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
}
