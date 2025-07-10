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
 * Determine if a snapshot should be a full snapshot or differential
 */
export function shouldBeFullSnapshot(version: number, changeType: ChangeType, fileCount: number): boolean {
  // Always make initial snapshots full
  if (changeType === 'initial' || version === 1) {
    return true;
  }

  // Make every 10th snapshot a full snapshot for easy reconstruction
  if (version % 10 === 0) {
    return true;
  }

  // If there are too many files, make it a full snapshot for performance
  if (fileCount > 100) {
    return true;
  }

  return false;
}

/**
 * Create a differential snapshot containing only changed files
 */
export function createDifferentialSnapshot(
  baseSnapshot: VersionedSnapshot,
  newFiles: FileMap,
  changeType: ChangeType,
  version: number,
): VersionedSnapshot {
  const changes = calculateChangedFiles(baseSnapshot.files, newFiles);
  const modifiedFiles = changes.map((change) => change.path);

  // Create a differential snapshot with only changed files
  const differentialFiles: FileMap = {};

  for (const change of changes) {
    if (change.type === 'added' || change.type === 'modified') {
      const newFile = newFiles[change.path];

      if (newFile) {
        differentialFiles[change.path] = newFile;
      }
    }

    // For deleted files, we don't include them in the differential snapshot
  }

  return {
    chatIndex: baseSnapshot.chatIndex,
    files: differentialFiles,
    summary: baseSnapshot.summary,
    version,
    timestamp: Date.now(),
    changeType,
    previousSnapshotId: `${baseSnapshot.chatIndex}-${baseSnapshot.version}`,
    isFullSnapshot: false,
    modifiedFiles,
    fullSnapshotRef: baseSnapshot.fullSnapshotRef || `${baseSnapshot.chatIndex}-${baseSnapshot.version}`,
  };
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
    isFullSnapshot: true,
    modifiedFiles: Object.keys(files),
  };
}

/**
 * Reconstruct a full snapshot from a differential snapshot
 */
export async function reconstructFullSnapshot(
  db: IDBDatabase,
  chatId: string,
  version: number,
): Promise<VersionedSnapshot | undefined> {
  const snapshot = await getVersionedSnapshot(db, chatId, version);

  if (!snapshot) {
    return undefined;
  }

  // If it's already a full snapshot, return it
  if (snapshot.isFullSnapshot) {
    return snapshot;
  }

  // Find the base full snapshot
  const fullSnapshotRef = snapshot.fullSnapshotRef;

  if (!fullSnapshotRef) {
    logger.error('No full snapshot reference found for differential snapshot');
    return undefined;
  }

  const baseVersion = parseInt(fullSnapshotRef.split('-').pop() || '0');
  const baseSnapshot = await getVersionedSnapshot(db, chatId, baseVersion);

  if (!baseSnapshot || !baseSnapshot.isFullSnapshot) {
    logger.error('Base full snapshot not found for reconstruction');
    return undefined;
  }

  // Get all snapshots between the base and target version
  const versionIndex = await getSnapshotVersions(db, chatId);

  if (!versionIndex) {
    return undefined;
  }

  const versionsToApply = versionIndex.versions
    .filter((v) => v.version > baseVersion && v.version <= version)
    .sort((a, b) => a.version - b.version);

  // Start with base snapshot files
  const reconstructedFiles: FileMap = { ...baseSnapshot.files };

  // Apply each differential snapshot in order
  for (const versionInfo of versionsToApply) {
    const diffSnapshot = await getVersionedSnapshot(db, chatId, versionInfo.version);

    if (diffSnapshot) {
      // Apply the changes from this differential snapshot
      for (const [path, file] of Object.entries(diffSnapshot.files)) {
        if (file) {
          reconstructedFiles[path] = file;
        }
      }

      // Handle deleted files (they won't be in the differential snapshot)
      if (diffSnapshot.modifiedFiles) {
        const changes = calculateChangedFiles(reconstructedFiles, diffSnapshot.files);

        for (const change of changes) {
          if (change.type === 'deleted') {
            delete reconstructedFiles[change.path];
          }
        }
      }
    }
  }

  // Return the reconstructed snapshot
  return {
    ...snapshot,
    files: reconstructedFiles,
    isFullSnapshot: true,
  };
}

/**
 * Get the most recent full snapshot before a given version
 */
export async function getLastFullSnapshot(
  db: IDBDatabase,
  chatId: string,
  beforeVersion: number,
): Promise<VersionedSnapshot | undefined> {
  const versionIndex = await getSnapshotVersions(db, chatId);

  if (!versionIndex) {
    return undefined;
  }

  // Find the most recent full snapshot before the given version
  const fullSnapshots = versionIndex.versions
    .filter((v) => v.version < beforeVersion && v.isFullSnapshot)
    .sort((a, b) => b.version - a.version);

  if (fullSnapshots.length === 0) {
    return undefined;
  }

  return getVersionedSnapshot(db, chatId, fullSnapshots[0].version);
}

/**
 * Check if files have actually changed compared to the last snapshot
 */
export async function hasFilesChanged(db: IDBDatabase, chatId: string, currentFiles: FileMap): Promise<boolean> {
  const lastSnapshot = await getLatestVersionedSnapshot(db, chatId);

  if (!lastSnapshot) {
    return true; // No previous snapshot, so files have "changed"
  }

  let lastFiles: FileMap;

  if (lastSnapshot.isFullSnapshot) {
    lastFiles = lastSnapshot.files;
  } else {
    const reconstructed = await reconstructFullSnapshot(db, chatId, lastSnapshot.version);

    if (!reconstructed) {
      return true; // Error reconstructing, assume changes
    }

    lastFiles = reconstructed.files;
  }

  const changes = calculateChangedFiles(lastFiles, currentFiles);

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
 * Create a versioned snapshot with automatic decision on full vs differential
 */
export async function createVersionedSnapshot(
  db: IDBDatabase,
  chatId: string,
  files: FileMap,
  chatIndex: string,
  changeType: ChangeType,
  summary?: string,
): Promise<VersionedSnapshot> {
  console.log('DEBUG: createVersionedSnapshot called with:', {
    chatId,
    filesCount: Object.keys(files).length,
    changeType,
  });

  const versionIndex = await getSnapshotVersions(db, chatId);
  const version = versionIndex ? versionIndex.latestVersion + 1 : 1;

  const shouldBeFull = shouldBeFullSnapshot(version, changeType, Object.keys(files).length);

  console.log('DEBUG: createVersionedSnapshot decision:', {
    version,
    shouldBeFull,
    filesCount: Object.keys(files).length,
  });

  if (shouldBeFull || !versionIndex || versionIndex.versions.length === 0) {
    // Create a full snapshot
    const previousSnapshotId =
      versionIndex && versionIndex.versions.length > 0 ? `${chatId}-${versionIndex.latestVersion}` : undefined;

    console.log('DEBUG: Creating full snapshot with', Object.keys(files).length, 'files');

    return createFullSnapshot(files, chatIndex, changeType, version, summary, previousSnapshotId);
  } else {
    // Create a differential snapshot
    const lastSnapshot = await getVersionedSnapshot(db, chatId, versionIndex.latestVersion);

    if (!lastSnapshot) {
      console.log('DEBUG: Last snapshot not found, creating full snapshot');

      // Fallback to full snapshot if we can't get the last one
      return createFullSnapshot(files, chatIndex, changeType, version, summary);
    }

    let baseFiles: FileMap;

    if (lastSnapshot.isFullSnapshot) {
      baseFiles = lastSnapshot.files;
    } else {
      const reconstructed = await reconstructFullSnapshot(db, chatId, lastSnapshot.version);

      if (!reconstructed) {
        console.log('DEBUG: Reconstruction failed, creating full snapshot');

        // Fallback to full snapshot if reconstruction fails
        return createFullSnapshot(files, chatIndex, changeType, version, summary);
      }

      baseFiles = reconstructed.files;
    }

    const baseSnapshot: VersionedSnapshot = {
      ...lastSnapshot,
      files: baseFiles,
    };

    console.log('DEBUG: Creating differential snapshot, current files:', Object.keys(files).length);

    return createDifferentialSnapshot(baseSnapshot, files, changeType, version);
  }
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
  chatIndex?: string,
  summary?: string,
  debounceMs: number = 2000,
): void {
  console.log('DEBUG: triggerSnapshot called with:', {
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
      const effectiveChatIndex = chatIndex || `snapshot-${Date.now()}`;

      console.log('DEBUG: triggerSnapshot processing:', {
        effectiveChatId,
        filesCount: Object.keys(files).length,
        changeType,
      });

      // Check if this is the first snapshot for this chat
      const hasSnapshots = await hasExistingSnapshots(db, effectiveChatId);

      if (!hasSnapshots) {
        // If no snapshots exist and we have files, this is likely an import or upload
        if (Object.keys(files).length > 0) {
          console.log('DEBUG: Creating initial snapshot with files:', Object.keys(files).length);

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
          console.log('DEBUG: Creating initial empty snapshot');

          // Create empty initial snapshot
          await createInitialSnapshot(db, effectiveChatId, effectiveChatIndex, summary);
        }

        return;
      }

      // For subsequent snapshots, check if files have actually changed
      const filesChanged = await hasFilesChanged(db, effectiveChatId, files);

      if (!filesChanged) {
        console.log('DEBUG: No file changes detected, skipping snapshot');
        logger.info(`No file changes detected for chat ${effectiveChatId}, skipping snapshot`);

        return;
      }

      console.log('DEBUG: Files changed, creating snapshot with', Object.keys(files).length, 'files');

      // Create and store the versioned snapshot
      const versionedSnapshot = await createVersionedSnapshot(
        db,
        effectiveChatId,
        files,
        effectiveChatIndex,
        changeType,
        summary,
      );

      console.log('DEBUG: Created versioned snapshot:', {
        version: versionedSnapshot.version,
        filesCount: Object.keys(versionedSnapshot.files).length,
        isFullSnapshot: versionedSnapshot.isFullSnapshot,
      });

      const { getNextSnapshotVersion, setVersionedSnapshot } = await import('./db');
      const version = await getNextSnapshotVersion(db, effectiveChatId);

      await setVersionedSnapshot(db, effectiveChatId, versionedSnapshot, version, changeType);

      logger.info(
        `Created ${changeType} snapshot version ${version} for chat ${effectiveChatId} (resolved from ${chatId})`,
      );
    } catch (error) {
      logger.error('Failed to create triggered snapshot:', error);
      console.error('DEBUG: triggerSnapshot error:', error);
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
