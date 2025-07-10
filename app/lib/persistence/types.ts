import type { FileMap } from '~/lib/stores/files';

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
}

// Types for versioned snapshots
export type ChangeType = 'initial' | 'upload' | 'ai-response' | 'user-edit';

export interface VersionedSnapshot extends Snapshot {
  version: number;
  timestamp: number;
  changeType: ChangeType;
  previousSnapshotId?: string;
  isFullSnapshot: boolean;
  modifiedFiles?: string[];
  fullSnapshotRef?: string;
}

export interface SnapshotVersion {
  chatId: string;
  version: number;
  timestamp: number;
  changeType: ChangeType;
  isFullSnapshot: boolean;
  snapshotId: string;
}

export interface SnapshotVersionIndex {
  chatId: string;
  versions: SnapshotVersion[];
  latestVersion: number;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
}
