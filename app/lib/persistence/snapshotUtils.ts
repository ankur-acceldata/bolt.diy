import type { FileMap } from '~/lib/stores/files';
import type { VersionedSnapshot, FileChange, ChangeType } from './types';
import { getVersionedSnapshot, getSnapshotVersions } from './db';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SnapshotUtils');

/**
 * Compare two FileMap objects and return the list of changes
 */
export function calculateChangedFiles(oldFiles: FileMap, newFiles: FileMap): FileChange[] {
  const changes: FileChange[] = [];
  const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

  for (const path of allPaths) {
    const oldFile = oldFiles[path];
    const newFile = newFiles[path];

    if (!oldFile && newFile) {
      // File was added
      changes.push({
        path,
        type: 'added',
        newContent: newFile.type === 'file' ? newFile.content : undefined,
      });
    } else if (oldFile && !newFile) {
      // File was deleted
      changes.push({
        path,
        type: 'deleted',
        oldContent: oldFile.type === 'file' ? oldFile.content : undefined,
      });
    } else if (oldFile && newFile) {
      // File might have been modified
      if (oldFile.type === 'file' && newFile.type === 'file') {
        if (oldFile.content !== newFile.content || oldFile.isBinary !== newFile.isBinary) {
          changes.push({
            path,
            type: 'modified',
            oldContent: oldFile.content,
            newContent: newFile.content,
          });
        }
      } else if (oldFile.type !== newFile.type) {
        // Type changed (file to folder or vice versa)
        changes.push({
          path,
          type: 'modified',
          oldContent: oldFile.type === 'file' ? oldFile.content : undefined,
          newContent: newFile.type === 'file' ? newFile.content : undefined,
        });
      }
    }
  }

  return changes;
}

/**
 * Check if two snapshots are identical
 */
export function areSnapshotsIdentical(snapshot1: VersionedSnapshot, snapshot2: VersionedSnapshot): boolean {
  // Quick check - if the number of files differs, they're not identical
  const files1Keys = Object.keys(snapshot1.files);
  const files2Keys = Object.keys(snapshot2.files);

  if (files1Keys.length !== files2Keys.length) {
    return false;
  }

  // Check each file
  for (const path of files1Keys) {
    const file1 = snapshot1.files[path];
    const file2 = snapshot2.files[path];

    if (!file1 || !file2) {
      return false;
    }

    if (file1.type !== file2.type) {
      return false;
    }

    if (file1.type === 'file' && file2.type === 'file') {
      if (file1.content !== file2.content || file1.isBinary !== file2.isBinary) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Create a full snapshot
 */
export function createFullSnapshot(
  files: FileMap,
  chatIndex: string,
  changeType: ChangeType,
  version: number,
  summary?: string,
  previousSnapshotId?: string,
): VersionedSnapshot {
  return {
    chatIndex,
    files,
    summary,
    version,
    timestamp: Date.now(),
    changeType,
    previousSnapshotId,
    modifiedFiles: Object.keys(files),
  };
}

/**
 * Check if files have actually changed compared to the last snapshot
 */
export async function hasFilesChanged(db: IDBDatabase, chatId: string, currentFiles: FileMap): Promise<boolean> {
  const lastSnapshot = await getLatestVersionedSnapshot(db, chatId);

  if (!lastSnapshot) {
    logger.debug('hasFilesChanged - No previous snapshot exists, allowing change');
    return true; // No previous snapshot, so files have "changed"
  }

  // Since all snapshots are now full snapshots, we can directly use the files
  const lastFiles = lastSnapshot.files;
  logger.debug('hasFilesChanged - Using full snapshot as baseline, files:', Object.keys(lastFiles).length);

  const changes = calculateChangedFiles(lastFiles, currentFiles);

  logger.debug('hasFilesChanged - Change detection:', {
    lastFilesCount: Object.keys(lastFiles).length,
    currentFilesCount: Object.keys(currentFiles).length,
    changesDetected: changes.length,
    changeTypes: changes.map((c) => `${c.path}: ${c.type}`).slice(0, 5), // Show first 5 changes
  });

  // Additional check: if we detect changes but current files is empty, something is wrong
  if (changes.length > 0 && Object.keys(currentFiles).length === 0) {
    logger.debug('hasFilesChanged - Detected changes but current files empty, blocking snapshot');
    return false;
  }

  return changes.length > 0;
}

/**
 * Get the latest versioned snapshot (wrapper for the db function)
 */
export async function getLatestVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
): Promise<VersionedSnapshot | undefined> {
  const versionIndex = await getSnapshotVersions(db, chatId);

  if (!versionIndex || versionIndex.versions.length === 0) {
    return undefined;
  }

  const latestVersion = versionIndex.latestVersion;

  return getVersionedSnapshot(db, chatId, latestVersion);
}

/**
 * Create a versioned snapshot (always full snapshot)
 */
export async function createVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
  files: FileMap,
  chatIndex: string,
  changeType: ChangeType,
  summary?: string,
): Promise<VersionedSnapshot> {
  logger.debug('createVersionedSnapshot called with:', {
    chatId,
    filesCount: Object.keys(files).length,
    changeType,
  });

  logger.debug('Will calculate modified files against first snapshot (v1) instead of latest');

  const versionIndex = await getSnapshotVersions(db, chatId);
  const version = versionIndex ? versionIndex.latestVersion + 1 : 1;

  // Calculate modified files by comparing with the first snapshot (version 1)
  let modifiedFiles: string[] = Object.keys(files);

  if (versionIndex && versionIndex.versions.length > 0) {
    // Use version 1 (first snapshot) instead of the latest version
    const firstSnapshot = await getVersionedSnapshot(db, chatId, 1);

    if (firstSnapshot) {
      const changes = calculateChangedFiles(firstSnapshot.files, files);
      modifiedFiles = changes.map((change) => change.path);
    }
  }

  const previousSnapshotId =
    versionIndex && versionIndex.versions.length > 0 ? `${chatId}-${versionIndex.latestVersion}` : undefined;

  logger.debug('Creating full snapshot with', Object.keys(files).length, 'files');

  return {
    chatIndex,
    files,
    summary,
    version,
    timestamp: Date.now(),
    changeType,
    previousSnapshotId,
    modifiedFiles,
  };
}

/**
 * Create an initial empty snapshot for a new chat
 * This establishes the baseline for the chat before any files are added
 */
export async function createInitialSnapshot(
  db: IDBDatabase,
  chatId: string,
  chatIndex: string,
  summary?: string,
): Promise<VersionedSnapshot> {
  logger.info(`Creating initial empty snapshot for chat ${chatId}`);

  // Create an empty file map for the initial snapshot
  const emptyFiles: FileMap = {};

  // Create the initial snapshot
  const initialSnapshot = createFullSnapshot(
    emptyFiles,
    chatIndex,
    'initial',
    1,
    summary || 'Initial empty project state',
  );

  // Store the initial snapshot in the database
  const { setVersionedSnapshot } = await import('./db');
  await setVersionedSnapshot(db, chatId, initialSnapshot, 1, 'initial');

  logger.info(`Created initial empty snapshot for chat ${chatId}`);

  return initialSnapshot;
}

/**
 * Check if a chat has any snapshots
 */
export async function hasExistingSnapshots(db: IDBDatabase, chatId: string): Promise<boolean> {
  const versionIndex = await getSnapshotVersions(db, chatId);
  return versionIndex !== undefined && versionIndex.versions.length > 0;
}

// Debounce map to prevent too many snapshots during rapid file changes
const snapshotDebounceMap = new Map<string, NodeJS.Timeout>();

/**
 * Trigger a snapshot with debouncing to prevent too many snapshots during rapid changes
 */
export function triggerSnapshot(
  db: IDBDatabase,
  chatId: string,
  files: FileMap,
  changeType: ChangeType,
  chatIndex: string,
  summary?: string,
  debounceMs: number = 2000,
): void {
  logger.debug('triggerSnapshot called with:', {
    chatId,
    filesCount: Object.keys(files).length,
    changeType,
  });

  // Clear any existing debounce timeout for this chat
  const existingTimeout = snapshotDebounceMap.get(chatId);

  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Set a new debounce timeout
  const timeout = setTimeout(async () => {
    try {
      // Resolve the mixed chatId to the actual chatId to prevent duplicate snapshots
      const { resolveActualChatId } = await import('~/utils/fileLocks');
      const actualChatId = await resolveActualChatId(chatId);

      // Use the resolved chatId for all snapshot operations
      const effectiveChatId = actualChatId;

      // Use a default chatIndex if not provided
      const effectiveChatIndex = chatIndex;

      logger.debug('triggerSnapshot processing:', {
        effectiveChatId,
        filesCount: Object.keys(files).length,
        changeType,
      });

      // Check if this is the first snapshot for this chat
      const hasSnapshots = await hasExistingSnapshots(db, effectiveChatId);

      if (!hasSnapshots) {
        // If no snapshots exist and we have files, this is likely an import or upload
        if (Object.keys(files).length > 0) {
          logger.debug('Creating initial snapshot with files:', Object.keys(files).length);

          // Create initial snapshot with imported/uploaded files
          const initialSnapshot = await createVersionedSnapshot(
            db,
            effectiveChatId,
            files,
            effectiveChatIndex,
            'initial',
            summary || 'Initial project state with imported files',
          );

          const { setVersionedSnapshot } = await import('./db');
          await setVersionedSnapshot(db, effectiveChatId, initialSnapshot, 1, 'initial');

          logger.info(`Created initial snapshot with ${Object.keys(files).length} files for chat ${effectiveChatId}`);
        } else {
          logger.debug('Creating initial empty snapshot');

          // Create empty initial snapshot
          await createInitialSnapshot(db, effectiveChatId, effectiveChatIndex, summary);
        }

        return;
      }

      // For subsequent snapshots, check if files have actually changed
      const filesChanged = await hasFilesChanged(db, effectiveChatId, files);

      if (!filesChanged) {
        logger.debug('No file changes detected, skipping snapshot');
        logger.info(`No file changes detected for chat ${effectiveChatId}, skipping snapshot`);

        return;
      }

      // Additional check: Don't create snapshots if we have 0 files
      if (Object.keys(files).length === 0) {
        logger.debug('Skipping snapshot creation - no files to snapshot');
        return;
      }

      logger.debug('Files changed, creating snapshot with', Object.keys(files).length, 'files');

      // Create and store the versioned snapshot
      const versionedSnapshot = await createVersionedSnapshot(
        db,
        effectiveChatId,
        files,
        effectiveChatIndex,
        changeType,
        summary,
      );

      logger.debug('Created versioned snapshot:', {
        version: versionedSnapshot.version,
        filesCount: Object.keys(versionedSnapshot.files).length,
      });

      const { getNextSnapshotVersion, setVersionedSnapshot } = await import('./db');
      const version = await getNextSnapshotVersion(db, effectiveChatId);

      await setVersionedSnapshot(db, effectiveChatId, versionedSnapshot, version, changeType);

      logger.info(
        `Created ${changeType} snapshot version ${version} for chat ${effectiveChatId} (resolved from ${chatId})`,
      );
    } catch (error) {
      logger.error('Failed to create triggered snapshot:', error);
      logger.error('triggerSnapshot error:', error);
    }

    // Remove the timeout from the map using the original chatId
    snapshotDebounceMap.delete(chatId);
  }, debounceMs);

  // Store the timeout in the map
  snapshotDebounceMap.set(chatId, timeout);
}

/**
 * Clear all pending snapshot timeouts (useful for cleanup)
 */
export function clearPendingSnapshots(): void {
  snapshotDebounceMap.forEach((timeout) => clearTimeout(timeout));
  snapshotDebounceMap.clear();
}
