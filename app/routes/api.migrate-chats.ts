import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.migrate-chats');

/**
 * API endpoint to trigger chat migration from IndexedDB to backend
 * This is a utility endpoint for migrating existing chats
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { action: migrationAction, chatId } = await request.json<{
      action: 'migrate-all' | 'migrate-single' | 'status' | 'verify';
      chatId?: string;
    }>();

    logger.info(`Migration action requested: ${migrationAction}`, chatId ? { chatId } : {});

    // Dynamic import to avoid loading migration service on every request
    const { ChatMigrationService: chatMigrationService } = await import('~/lib/services/chatMigrationService');

    switch (migrationAction) {
      case 'migrate-all': {
        const result = await chatMigrationService.migrateAllChats();
        return json({
          success: result.success,
          data: result,
          message: `Migration completed: ${result.migratedChats}/${result.totalChats} successful`,
        });
      }

      case 'migrate-single': {
        if (!chatId) {
          return json({ error: 'chatId is required for single migration', success: false }, { status: 400 });
        }

        const success = await chatMigrationService.migrateSingleChat(chatId);

        return json({
          success,
          message: success ? `Chat ${chatId} migrated successfully` : `Failed to migrate chat ${chatId}`,
        });
      }

      case 'status': {
        const status = await chatMigrationService.getMigrationStatus();
        return json({
          success: true,
          data: status,
          message: `Migration status: ${status.migratedChats}/${status.totalChats} migrated`,
        });
      }

      case 'verify': {
        if (!chatId) {
          return json({ error: 'chatId is required for verification', success: false }, { status: 400 });
        }

        const verification = await chatMigrationService.verifyMigration(chatId);

        return json({
          success: verification.isValid,
          data: verification,
          message: verification.isValid ? 'Migration verified successfully' : 'Migration verification failed',
        });
      }

      default:
        return json({ error: 'Invalid action', success: false }, { status: 400 });
    }
  } catch (error) {
    logger.error('Migration action failed:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}
