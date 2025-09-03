import type { FileMap } from '~/lib/stores/files';

export interface Snapshot {
  chatIndex: string;
  files: FileMap;
  summary?: string;
}

export type ChangeType = 'initial' | 'upload' | 'ai-response' | 'user-edit';

// Matches the 'snapshot' field in the DB record
export interface VersionedSnapshot {
  changeType: ChangeType;
  chatIndex: string;
  files: FileMap;
  modifiedFiles?: string[];
  previousSnapshotId?: string;
  summary?: string;
  timestamp: number;
  version: number;
}

// Matches the top-level object in the 'versioned_snapshots' store
export interface VersionedSnapshotRecord {
  id: string;
  chatId: string;
  version: number;
  timestamp: number;
  changeType: ChangeType;
  snapshot: VersionedSnapshot;
}

export interface SnapshotVersion {
  chatId: string;
  version: number;
  timestamp: number;
  changeType: ChangeType;
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
