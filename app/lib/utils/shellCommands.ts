import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('shellCommands');

/**
 * Validates if a command set is complete and executable
 * A complete command set should have both install/setup AND execution commands
 */
function isExecutableCommandSet(commands: string[], hasFileActions: boolean): boolean {
  if (commands.length === 0) {
    return false;
  }

  // For Python projects
  const hasPipInstall = commands.some(
    (cmd) => cmd.toLowerCase().includes('pip install') || cmd.toLowerCase().includes('pip3 install'),
  );

  const hasPythonExecution = commands.some(
    (cmd) =>
      cmd.toLowerCase().includes('python') &&
      !cmd.toLowerCase().includes('pip') &&
      (cmd.includes('-m') || cmd.includes('.py') || cmd.includes('main')),
  );

  // For Node.js projects
  const hasNpmInstall = commands.some(
    (cmd) =>
      cmd.toLowerCase().includes('npm install') ||
      cmd.toLowerCase().includes('yarn install') ||
      cmd.toLowerCase().includes('pnpm install'),
  );

  const hasNodeExecution = commands.some(
    (cmd) =>
      (cmd.toLowerCase().includes('npm') && cmd.toLowerCase().includes('run')) ||
      (cmd.toLowerCase().includes('yarn') && cmd.toLowerCase().includes('run')) ||
      (cmd.toLowerCase().includes('pnpm') && cmd.toLowerCase().includes('run')) ||
      cmd.toLowerCase().includes('node '),
  );

  // For Java projects
  const hasMavenBuild = commands.some(
    (cmd) =>
      cmd.toLowerCase().includes('mvn') &&
      (cmd.includes('compile') || cmd.includes('package') || cmd.includes('install')),
  );

  const hasJavaExecution = commands.some(
    (cmd) =>
      (cmd.toLowerCase().includes('mvn') && cmd.includes('exec:java')) ||
      cmd.toLowerCase().includes('java -jar') ||
      cmd.toLowerCase().includes('java '),
  );

  // Check for complete command sets based on project type
  const isPythonComplete = hasPipInstall && hasPythonExecution;
  const isNodeComplete = hasNpmInstall && hasNodeExecution;
  const isJavaComplete = hasMavenBuild && hasJavaExecution;

  // Additional validation: should have file actions for a complete solution
  const hasCompleteProject = hasFileActions && (isPythonComplete || isNodeComplete || isJavaComplete);

  // Log validation details for debugging
  logger.info('Command set validation:', {
    totalCommands: commands.length,
    hasFileActions,
    python: { hasPipInstall, hasPythonExecution, complete: isPythonComplete },
    node: { hasNpmInstall, hasNodeExecution, complete: isNodeComplete },
    java: { hasMavenBuild, hasJavaExecution, complete: isJavaComplete },
    isCompleteProject: hasCompleteProject,
    commands,
  });

  return hasCompleteProject;
}

/**
 * Helper function to extract shell commands from bolt actions
 * Searches backwards through artifacts to find the last complete set of shell commands
 */
export function extractShellCommands(): string[] {
  const artifacts = workbenchStore.artifacts.get();
  const artifactIdList = workbenchStore.artifactIdList;

  logger.info('DEBUG: Starting shell command extraction:', {
    artifactIdListLength: artifactIdList.length,
    artifactIds: artifactIdList,
    totalArtifacts: Object.keys(artifacts).length,
  });

  // If no artifacts, return empty array
  if (artifactIdList.length === 0) {
    logger.warn('No artifacts available for command extraction - artifactIdList is empty');
    return [];
  }

  // Search backwards through artifacts to find the last complete set of shell commands
  for (let i = artifactIdList.length - 1; i >= 0; i--) {
    const messageId = artifactIdList[i];
    const artifact = artifacts[messageId];

    if (!artifact) {
      logger.warn(`Artifact not found for messageId: ${messageId}`);
      continue;
    }

    const actions = artifact.runner.actions.get();
    const shellCommands: string[] = [];
    let hasFileActions = false;

    // Extract shell commands and check for file actions
    Object.values(actions).forEach((action) => {
      if (action.type === 'shell' && action.content) {
        const commands = action.content
          .split('\n')
          .map((cmd) => cmd.trim())
          .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'));

        shellCommands.push(...commands);
      } else if (action.type === 'file') {
        hasFileActions = true;
      }
    });

    // Only return if this is a complete and executable command set
    if (isExecutableCommandSet(shellCommands, hasFileActions)) {
      logger.info('Found shell commands from AI message artifact:', {
        messageId,
        artifactTitle: artifact.title,
        artifactIndex: i,
        totalCommands: shellCommands.length,
        commands: shellCommands,
      });

      return shellCommands;
    }
  }

  logger.warn('No shell commands found in any artifact - will use fallback stages');

  return [];
}

/**
 * Get the last complete set of shell commands that were actually provided by AI
 * This is used as a fallback instead of hardcoded commands
 */
export function getLastCompleteShellCommands(): string[] {
  const artifacts = workbenchStore.artifacts.get();
  const artifactIdList = workbenchStore.artifactIdList;

  logger.info('Searching for last complete shell command set across all artifacts');

  // Search backwards through all artifacts to find the most recent complete command set
  for (let i = artifactIdList.length - 1; i >= 0; i--) {
    const messageId = artifactIdList[i];
    const artifact = artifacts[messageId];

    if (!artifact) {
      continue;
    }

    const actions = artifact.runner.actions.get();
    const shellCommands: string[] = [];
    let hasFileActions = false;

    // Check if this artifact has both file actions and shell commands (complete response)
    Object.values(actions).forEach((action) => {
      if (action.type === 'shell' && action.content) {
        const commands = action.content
          .split('\n')
          .map((cmd) => cmd.trim())
          .filter((cmd) => cmd.length > 0 && !cmd.startsWith('#'));

        shellCommands.push(...commands);
      } else if (action.type === 'file') {
        hasFileActions = true;
      }
    });

    // Consider this a "complete" response only if it has a full execution cycle
    const isCompleteCommandSet = isExecutableCommandSet(shellCommands, hasFileActions);

    if (isCompleteCommandSet) {
      logger.info('Found last complete shell command set:', {
        messageId,
        artifactTitle: artifact.title,
        artifactIndex: i,
        totalCommands: shellCommands.length,
        hasFileActions,
        commands: shellCommands,
      });

      return shellCommands;
    }
  }

  // If we didn't find a complete set, try to build one from the most recent commands
  logger.info('No complete shell command set found, attempting to build from recent commands');

  return buildCompleteCommandSet(artifacts, artifactIdList);
}

/**
 * Attempts to build a complete command set by combining recent install and execution commands
 * from different artifacts in the conversation
 */
function buildCompleteCommandSet(artifacts: any, artifactIdList: string[]): string[] {
  const recentInstallCommands: string[] = [];
  const recentExecutionCommands: string[] = [];
  let hasRecentFileActions = false;

  // Look through the last few artifacts to find install and execution commands
  const artifactsToCheck = Math.min(5, artifactIdList.length); // Check last 5 artifacts max

  for (let i = artifactIdList.length - artifactsToCheck; i < artifactIdList.length; i++) {
    const messageId = artifactIdList[i];
    const artifact = artifacts[messageId];

    if (!artifact) {
      continue;
    }

    const actions = artifact.runner.actions.get();

    Object.values(actions).forEach((action: any) => {
      if (action.type === 'shell' && action.content) {
        const commands = action.content
          .split('\n')
          .map((cmd: string) => cmd.trim())
          .filter((cmd: string) => cmd.length > 0 && !cmd.startsWith('#'));

        commands.forEach((cmd: string) => {
          // Categorize commands
          if (
            cmd.toLowerCase().includes('pip install') ||
            cmd.toLowerCase().includes('npm install') ||
            cmd.toLowerCase().includes('mvn compile')
          ) {
            recentInstallCommands.push(cmd);
          } else if (
            (cmd.toLowerCase().includes('python') && !cmd.toLowerCase().includes('pip')) ||
            cmd.toLowerCase().includes('node ') ||
            cmd.toLowerCase().includes('npm run') ||
            cmd.toLowerCase().includes('mvn exec')
          ) {
            recentExecutionCommands.push(cmd);
          }
        });
      } else if (action.type === 'file') {
        hasRecentFileActions = true;
      }
    });
  }

  // Combine the most recent install and execution commands
  const combinedCommands = [
    ...recentInstallCommands.slice(-2), // Take last 2 install commands
    ...recentExecutionCommands.slice(-1), // Take last 1 execution command
  ];

  logger.info('Built combined command set from recent artifacts:', {
    installCommands: recentInstallCommands.slice(-2),
    executionCommands: recentExecutionCommands.slice(-1),
    hasRecentFileActions,
    combinedCommands,
  });

  // Validate the combined set
  if (isExecutableCommandSet(combinedCommands, hasRecentFileActions)) {
    return combinedCommands;
  }

  logger.warn('Could not build a complete command set from recent artifacts');

  return [];
}
