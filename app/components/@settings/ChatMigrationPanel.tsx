import { useState } from 'react';
import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatMigrationPanel');

interface MigrationStatus {
  totalChats: number;
  migratedChats: number;
  unmigratedChats: number;
}

interface MigrationResult {
  success: boolean;
  totalChats: number;
  migratedChats: number;
  failedChats: number;
  errors: Array<{ chatId: string; error: string }>;
}

/**
 * Panel for managing chat migration from IndexedDB to backend
 */
export function ChatMigrationPanel() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/migrate-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      const result = (await response.json()) as any;

      if (result.success) {
        setStatus(result.data);
      } else {
        toast.error('Failed to fetch migration status');
      }
    } catch (error) {
      logger.error('Failed to fetch migration status:', error);
      toast.error('Failed to fetch migration status');
    } finally {
      setIsLoading(false);
    }
  };

  const migrateAll = async () => {
    if (!confirm('This will migrate all chats from IndexedDB to backend. Continue?')) {
      return;
    }

    try {
      setIsLoading(true);
      toast.info('Migration started... This may take a while.');

      const response = await fetch('/api/migrate-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'migrate-all' }),
      });

      const result = (await response.json()) as any;

      if (result.success) {
        setMigrationResult(result.data);
        toast.success(`Migration completed: ${result.data.migratedChats}/${result.data.totalChats} successful`);
        await fetchStatus(); // Refresh status
      } else {
        toast.error('Migration failed');
      }
    } catch (error) {
      logger.error('Migration failed:', error);
      toast.error('Migration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2">
      <h3 className="text-lg font-semibold mb-4 text-bolt-elements-textPrimary">Chat Migration</h3>

      <p className="text-sm text-bolt-elements-textSecondary mb-4">
        Migrate your chats from local IndexedDB storage to backend storage for cross-device synchronization.
      </p>

      {/* Status Section */}
      <div className="mb-4">
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="px-4 py-2 bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Check Migration Status'}
        </button>

        {status && (
          <div className="mt-4 p-3 bg-bolt-elements-background-depth-3 rounded">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-bolt-elements-textPrimary">{status.totalChats}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Total Chats</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{status.migratedChats}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Migrated</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-500">{status.unmigratedChats}</div>
                <div className="text-xs text-bolt-elements-textSecondary">Pending</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Migration Action */}
      {status && status.unmigratedChats > 0 && (
        <div className="mb-4">
          <button
            onClick={migrateAll}
            disabled={isLoading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? 'Migrating...' : `Migrate ${status.unmigratedChats} Chats`}
          </button>
        </div>
      )}

      {/* Migration Result */}
      {migrationResult && (
        <div className="mt-4 p-3 bg-bolt-elements-background-depth-3 rounded">
          <h4 className="font-semibold mb-2 text-bolt-elements-textPrimary">Migration Result</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Total:</span>
              <span className="text-bolt-elements-textPrimary">{migrationResult.totalChats}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Successful:</span>
              <span className="text-green-500">{migrationResult.migratedChats}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bolt-elements-textSecondary">Failed:</span>
              <span className="text-red-500">{migrationResult.failedChats}</span>
            </div>
          </div>

          {migrationResult.errors.length > 0 && (
            <div className="mt-3">
              <h5 className="font-semibold text-sm mb-1 text-bolt-elements-textPrimary">Errors:</h5>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {migrationResult.errors.map((error, index) => (
                  <div key={index} className="text-xs text-red-500">
                    Chat {error.chatId}: {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-xs text-bolt-elements-textSecondary">
        <strong className="text-bolt-elements-textPrimary">Note:</strong> Migration is non-destructive. Your chats will
        remain in IndexedDB as a backup. Backend storage enables cross-device synchronization and better data
        persistence.
      </div>
    </div>
  );
}
