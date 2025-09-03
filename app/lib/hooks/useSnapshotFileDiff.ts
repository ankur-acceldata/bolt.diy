import { useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap } from '~/lib/stores/files';
import { getSnapshotVersions, getVersionedSnapshot, openDatabase } from '~/lib/persistence/db';
import { calculateChangedFiles } from '~/lib/persistence/snapshotUtils';
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
        try {
          setDiffData((prev) => ({ ...prev, isLoading: true, error: undefined }));

          const db = await openDatabase();

          if (!db) {
            throw new Error('Database unavailable');
          }

          const currentChatId = getCurrentChatId();

          if (!currentChatId) {
            setDiffData({ fileChanges: {}, isLoading: false });
            return;
          }

          const actualChatId = await resolveActualChatId(currentChatId);
          const versionIndex = await getSnapshotVersions(db, actualChatId);

          if (!versionIndex || versionIndex.versions.length === 0) {
            setDiffData({ fileChanges: {}, isLoading: false });
            return;
          }

          // Get first and latest snapshots
          const firstSnapshot = await getVersionedSnapshot(db, actualChatId, versionIndex.versions[0].version);
          const latestSnapshot = await getVersionedSnapshot(db, actualChatId, versionIndex.latestVersion);

          if (!firstSnapshot || !latestSnapshot) {
            throw new Error('Failed to load snapshots');
          }

          // Since all snapshots are now full snapshots, we can directly use their files
          const firstFiles = firstSnapshot.files;
          const latestFiles = latestSnapshot.files;

          logger.info(
            `Comparing snapshots - First: ${Object.keys(firstFiles).length} files, Latest: ${Object.keys(latestFiles).length} files`,
          );

          // Calculate changes between first and latest snapshots
          const changes = calculateChangedFiles(firstFiles, latestFiles);

          // Transform changes into our diff format
          const fileChanges: Record<string, SnapshotFileDiff> = {};

          changes.forEach((change) => {
            fileChanges[change.path] = {
              filePath: change.path,
              changeType: change.type,
              originalContent: change.oldContent,
              currentContent: change.newContent,
              hasChanges: true,
            };
          });

          if (isMounted) {
            setDiffData({
              fileChanges,
              firstSnapshot,
              latestSnapshot,
              isLoading: false,
            });
          }
        } catch (error) {
          logger.error('Failed to load snapshot diff:', error);

          if (isMounted) {
            setDiffData({
              fileChanges: {},
              isLoading: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      };

      loadSnapshotDiff();
    }, 1000); // 1 second delay

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
