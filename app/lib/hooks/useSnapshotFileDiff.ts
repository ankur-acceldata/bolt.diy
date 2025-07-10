import { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File } from '~/lib/stores/files';
import { getSnapshotVersions, getVersionedSnapshot, openDatabase } from '~/lib/persistence/db';
import { calculateChangedFiles, reconstructFullSnapshot } from '~/lib/persistence/snapshotUtils';
import { getCurrentChatId, resolveActualChatId } from '~/utils/fileLocks';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useSnapshotFileDiff');

export interface SnapshotFileDiff {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  originalContent?: string;
  currentContent?: string;
  hasChanges: boolean;
}

export interface SnapshotDiffData {
  fileChanges: Record<string, SnapshotFileDiff>;
  firstSnapshot?: any;
  latestSnapshot?: any;
  isLoading: boolean;
  error?: string;
}

/**
 * Hook to compare first and latest snapshots for comprehensive diff view
 */
export function useSnapshotFileDiff(): SnapshotDiffData {
  const files = useStore(workbenchStore.files) as FileMap;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const [diffData, setDiffData] = useState<SnapshotDiffData>({
    fileChanges: {},
    isLoading: false,
  });

  useEffect(() => {
    let isMounted = true;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Add a small delay to prevent diff calculation during rapid file changes (like uploads)
    timeoutRef.current = setTimeout(() => {
      const loadSnapshotDiff = async () => {
        const chatId = getCurrentChatId();

        if (!chatId) {
          setDiffData({ fileChanges: {}, isLoading: false });
          return;
        }

        setDiffData((prev) => ({ ...prev, isLoading: true, error: undefined }));

        try {
          const db = await openDatabase();

          if (!db) {
            throw new Error('Database not available');
          }

          // Resolve the actual chat ID
          const actualChatId = await resolveActualChatId(chatId);

          // Get version index
          const versionIndex = await getSnapshotVersions(db, actualChatId);

          if (!versionIndex || versionIndex.versions.length === 0) {
            // No snapshots exist yet - don't show any diffs until baseline is established
            if (isMounted) {
              setDiffData({
                fileChanges: {},
                isLoading: false,
              });
            }

            return;
          }

          // Get first and latest snapshots
          const firstVersion = versionIndex.versions[0];
          const latestVersion = versionIndex.versions[versionIndex.versions.length - 1];

          let firstSnapshot = await getVersionedSnapshot(db, actualChatId, firstVersion.version);
          let latestSnapshot = await getVersionedSnapshot(db, actualChatId, latestVersion.version);

          if (!firstSnapshot || !latestSnapshot) {
            throw new Error('Failed to load snapshots');
          }

          // Always reconstruct full snapshots for both first and latest
          if (!firstSnapshot.isFullSnapshot) {
            const reconstructed = await reconstructFullSnapshot(db, actualChatId, firstSnapshot.version);

            if (reconstructed) {
              firstSnapshot = reconstructed;
            }
          }

          // Always reconstruct the latest snapshot to get the full file map
          if (!latestSnapshot.isFullSnapshot) {
            const reconstructed = await reconstructFullSnapshot(db, actualChatId, latestSnapshot.version);

            if (reconstructed) {
              latestSnapshot = reconstructed;
            }
          }

          /*
           * Compare first snapshot vs current workbench files
           * This ensures we see all current files compared to baseline,
           * regardless of differential snapshot content
           */
          const changes = calculateChangedFiles(firstSnapshot.files, files);

          if (versionIndex.versions.length === 1 || changes.length === 0) {
            if (isMounted) {
              setDiffData({
                fileChanges: {},
                firstSnapshot,
                latestSnapshot,
                isLoading: false,
              });
            }

            return;
          }

          // Convert to our diff format
          const fileChanges: Record<string, SnapshotFileDiff> = {};

          for (const change of changes) {
            // For files, get the current content from workbench
            const currentFile = files[change.path];
            const currentContent =
              currentFile && currentFile.type === 'file' ? (currentFile as File).content : change.newContent;

            fileChanges[change.path] = {
              filePath: change.path,
              changeType: change.type,
              originalContent: change.oldContent,
              currentContent,
              hasChanges: true,
            };
          }

          // No need for additional workbench file checking since we're already comparing against current files

          if (isMounted) {
            setDiffData({
              fileChanges,
              firstSnapshot,
              latestSnapshot,
              isLoading: false,
            });
          }

          logger.info(`Loaded snapshot diff: ${Object.keys(fileChanges).length} changed files`);
        } catch (error) {
          logger.error('Failed to load snapshot diff:', error);

          if (isMounted) {
            setDiffData({
              fileChanges: {},
              isLoading: false,
              error: error instanceof Error ? error.message : 'Failed to load snapshot diff',
            });
          }
        }
      };

      loadSnapshotDiff();
    }, 500); // 500ms delay to allow upload operations to settle

    return () => {
      isMounted = false;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [files]);

  return diffData;
}

/**
 * Get file change type and content for a specific file path
 */
export function useFileSnapshotDiff(filePath: string): SnapshotFileDiff | undefined {
  const { fileChanges } = useSnapshotFileDiff();
  return fileChanges[filePath];
}

/**
 * Check if a file has changes between snapshots
 */
export function useFileHasSnapshotChanges(filePath: string): boolean {
  const fileDiff = useFileSnapshotDiff(filePath);
  return fileDiff?.hasChanges ?? false;
}

/**
 * Get all files with changes for file tree display
 */
export function useSnapshotChangedFiles(): string[] {
  const { fileChanges } = useSnapshotFileDiff();
  return Object.keys(fileChanges);
}
