import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('shellCommands');

/**
 * Helper function to extract shell commands from bolt actions
 * Only extracts commands from the latest AI message artifact
 */
export function extractShellCommands(): string[] {
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
}
