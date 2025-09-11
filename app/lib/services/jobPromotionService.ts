import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import { extractShellCommands } from '~/lib/utils/shellCommands';
import { description } from '~/lib/persistence';

const logger = createScopedLogger('jobPromotionService');

export interface JobPromotionParams {
  mainApplicationFile: string;
  arguments: string[];
  name: string;
}

/**
 * Service for extracting job creation parameters from successful pipeline execution
 */
export class JobPromotionService {
  /**
   * Extract job creation parameters - only the 3 required values
   */
  static extractJobCreationParams(): JobPromotionParams | null {
    try {
      // 1. Find main application file from artifacts
      const mainApplicationFile = this._findMainApplicationFile();

      if (!mainApplicationFile) {
        return null;
      }

      // 2. Extract arguments from shell commands
      const argumentsList = this._extractApplicationArguments();

      // 3. Resolve project name (align with pipeline config)
      const projectName = (description.get() ?? 'project').toLowerCase().split(' ').join('_');

      return {
        mainApplicationFile,
        arguments: argumentsList,
        name: projectName,
      };
    } catch (error) {
      logger.error('Failed to extract job creation parameters:', error);
      return null;
    }
  }

  /**
   * Find main application file from workbench artifacts
   */
  private static _findMainApplicationFile(): string | null {
    try {
      const artifacts = workbenchStore.artifacts.get();
      const artifactIdList = workbenchStore.artifactIdList;

      if (artifactIdList.length === 0) {
        return null;
      }

      // Get latest artifact (most recent AI generation)
      const latestMessageId = artifactIdList[artifactIdList.length - 1];
      const latestArtifact = artifacts[latestMessageId];

      if (!latestArtifact) {
        return null;
      }

      const actions = latestArtifact.runner.actions.get();

      // First, extract WORKDIR from Dockerfile
      const workDir = this._extractWorkdirFromDockerfile(actions);

      // Look for Python main files in the artifacts
      for (const action of Object.values(actions)) {
        if (action.type === 'file' && action.filePath) {
          const filePath = action.filePath;

          // Check for common Python main file patterns
          if (this._isMainApplicationFile(filePath)) {
            // Construct path based on Dockerfile WORKDIR
            const fileName = filePath.split('/').pop() || filePath;
            return workDir ? `${workDir}/${fileName}` : fileName;
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Error finding main application file:', error);
      return null;
    }
  }

  /**
   * Extract WORKDIR from Dockerfile in the artifacts
   */
  private static _extractWorkdirFromDockerfile(actions: Record<string, any>): string | null {
    try {
      // Look for Dockerfile in the artifacts
      for (const action of Object.values(actions)) {
        if (action.type === 'file' && action.filePath) {
          const filePath = action.filePath.toLowerCase();

          // Check for Dockerfile (case insensitive)
          if (filePath === 'dockerfile' || filePath.endsWith('/dockerfile')) {
            const dockerfileContent = action.content || '';

            // Extract WORKDIR from Dockerfile content
            const workdirMatch = dockerfileContent.match(/^\s*WORKDIR\s+(.+)$/im);

            if (workdirMatch) {
              // Clean up the path (remove quotes if present)
              const workdir = workdirMatch[1].trim().replace(/['"]/g, '');
              logger.info('Found WORKDIR in Dockerfile:', workdir);

              return workdir;
            }
          }
        }
      }

      logger.info('No WORKDIR found in Dockerfile, using default');

      return null;
    } catch (error) {
      logger.error('Error extracting WORKDIR from Dockerfile:', error);
      return null;
    }
  }

  /**
   * Check if a file path represents a main Python application file
   */
  private static _isMainApplicationFile(filePath: string): boolean {
    if (!filePath.endsWith('.py')) {
      return false;
    }

    const fileName = filePath.split('/').pop() || '';

    // Common Python main file patterns
    const mainPatterns = [
      'main.py',
      'app.py',
      'application.py',
      '__main__.py',
      /.*_main\.py$/,
      /.*main\.py$/,
      /.*app\.py$/,
    ];

    return mainPatterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return fileName === pattern;
      }

      return pattern.test(fileName);
    });
  }

  /**
   * Extract application arguments from shell commands
   */
  private static _extractApplicationArguments(): string[] {
    try {
      // Extract from current shell commands
      const shellCommands = extractShellCommands();

      // Parse arguments from shell commands
      for (const command of shellCommands) {
        const args = this._parseArgumentsFromCommand(command);

        if (args.length > 0) {
          return args;
        }
      }

      // Default arguments for Spark Python applications
      return ['100'];
    } catch (error) {
      logger.error('Error extracting application arguments:', error);
      return ['100']; // Fallback default
    }
  }

  /**
   * Parse arguments from a command string
   */
  private static _parseArgumentsFromCommand(command: string): string[] {
    try {
      // Handle Python execution: python main.py arg1 arg2 arg3
      const pythonMatch = command.match(/python3?\s+[^\s]+\.py\s+(.+)$/);

      if (pythonMatch) {
        return pythonMatch[1].split(/\s+/).filter((arg) => arg.length > 0 && !arg.startsWith('-'));
      }

      // Handle spark-submit for Python: spark-submit --py-files ... main.py arg1 arg2
      const sparkSubmitPyMatch = command.match(/spark-submit.*\.py\s+(.+)$/);

      if (sparkSubmitPyMatch) {
        return sparkSubmitPyMatch[1].split(/\s+/).filter((arg) => arg.length > 0);
      }

      // Handle pip install commands (no arguments needed for those)
      if (command.includes('pip install')) {
        return [];
      }

      return [];
    } catch (error) {
      logger.error('Error parsing arguments from command:', command, error);

      return [];
    }
  }
}
