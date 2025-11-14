# Backend Chat Persistence - Usage Examples

This document provides practical examples of how to use the backend chat persistence system.

## Table of Contents
1. [Basic Usage](#basic-usage)
2. [Migration Examples](#migration-examples)
3. [Advanced Usage](#advanced-usage)
4. [Troubleshooting Examples](#troubleshooting-examples)

## Basic Usage

### Saving a Chat (Automatic)

The system automatically saves to both IndexedDB and backend when you use the existing `setMessages` function:

```typescript
import { setMessages } from '~/lib/persistence/db';
import type { Message } from 'ai';

// Your existing code continues to work unchanged
const messages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, world!',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Hi there! How can I help you?',
  },
];

// Save chat (automatically syncs to backend)
await setMessages(
  db,
  chatId,
  messages,
  chatId, // urlId (same as chatId in unified system)
  'My Chat Title',
  undefined, // timestamp (auto-generated)
  {
    gitUrl: '',
    projectId: chatId,
  }
);

// That's it! The chat is now in both IndexedDB and backend
```

### Loading a Chat (Automatic)

Loading also works automatically with backend-first strategy:

```typescript
import { getMessages } from '~/lib/persistence/db';

// Load chat (tries backend first, falls back to IndexedDB)
const chat = await getMessages(db, chatId);

console.log(`Loaded ${chat.messages.length} messages`);
console.log(`Chat title: ${chat.description}`);
```

## Migration Examples

### Example 1: Check Migration Status

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';

async function checkStatus() {
  const status = await ChatMigrationService.getMigrationStatus();
  
  console.log(`Total chats: ${status.totalChats}`);
  console.log(`Migrated: ${status.migratedChats}`);
  console.log(`Pending: ${status.unmigratedChats}`);
  
  if (status.unmigratedChats > 0) {
    console.log(`You have ${status.unmigratedChats} chats to migrate`);
  } else {
    console.log('All chats are migrated! ✅');
  }
}
```

### Example 2: Migrate All Chats

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';
import { toast } from 'react-toastify';

async function migrateAllChats() {
  // Show loading indicator
  toast.info('Starting migration...');
  
  const result = await ChatMigrationService.migrateAllChats();
  
  if (result.success) {
    toast.success(
      `Migration complete! ${result.migratedChats}/${result.totalChats} chats migrated`
    );
  } else {
    toast.error(
      `Migration completed with errors: ${result.failedChats} failed`
    );
    
    // Log errors for debugging
    result.errors.forEach(error => {
      console.error(`Chat ${error.chatId}: ${error.error}`);
    });
  }
  
  return result;
}
```

### Example 3: Migrate Single Chat

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';

async function migrateSingleChat(chatId: string) {
  console.log(`Migrating chat ${chatId}...`);
  
  const success = await ChatMigrationService.migrateSingleChat(chatId);
  
  if (success) {
    console.log(`✅ Chat ${chatId} migrated successfully`);
  } else {
    console.error(`❌ Failed to migrate chat ${chatId}`);
  }
  
  return success;
}
```

### Example 4: Verify Migration

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';

async function verifyMigration(chatId: string) {
  const verification = await ChatMigrationService.verifyMigration(chatId);
  
  console.log(`IndexedDB messages: ${verification.indexedDBMessageCount}`);
  console.log(`Backend messages: ${verification.backendMessageCount}`);
  
  if (verification.isValid) {
    console.log('✅ Migration verified - data matches!');
  } else {
    console.error('❌ Migration verification failed:');
    verification.differences.forEach(diff => {
      console.error(`  - ${diff}`);
    });
  }
  
  return verification;
}
```

### Example 5: Batch Migration with Progress

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';
import { openDatabase, getAll } from '~/lib/persistence/db';

async function migrateWithProgress(
  onProgress: (current: number, total: number) => void
) {
  const db = await openDatabase();
  if (!db) throw new Error('Database not available');
  
  const chats = await getAll(db);
  const total = chats.length;
  let current = 0;
  
  for (const chat of chats) {
    const isMigrated = await ChatMigrationService.isChatMigrated(chat.id);
    
    if (!isMigrated) {
      await ChatMigrationService.migrateSingleChat(chat.id);
    }
    
    current++;
    onProgress(current, total);
  }
  
  return { total, migrated: current };
}

// Usage
await migrateWithProgress((current, total) => {
  const percent = Math.round((current / total) * 100);
  console.log(`Migration progress: ${percent}% (${current}/${total})`);
});
```

## Advanced Usage

### Example 6: Direct Backend Operations

```typescript
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';
import type { Message } from 'ai';

async function directBackendSave() {
  const messages: Message[] = [
    { id: 'msg-1', role: 'user', content: 'Hello' },
    { id: 'msg-2', role: 'assistant', content: 'Hi!' },
  ];
  
  // Save directly to backend (bypassing IndexedDB)
  await BackendPersistenceService.saveChat(
    'chat-123',
    messages,
    'My Chat',
    { gitUrl: '', projectId: 'chat-123' }
  );
  
  console.log('Saved directly to backend');
}

async function directBackendLoad() {
  // Load directly from backend
  const chat = await BackendPersistenceService.loadChat('chat-123');
  
  if (chat) {
    console.log(`Loaded ${chat.messages.length} messages from backend`);
  } else {
    console.log('Chat not found in backend');
  }
}
```

### Example 7: Append Messages Incrementally

```typescript
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';

async function addNewMessages(chatId: string, newMessages: Message[]) {
  // Append messages without reloading entire chat
  await BackendPersistenceService.appendMessages(chatId, newMessages);
  
  console.log(`Added ${newMessages.length} new messages to chat ${chatId}`);
}

// Usage
const newMessage: Message = {
  id: 'msg-3',
  role: 'user',
  content: 'Another message',
};

await addNewMessages('chat-123', [newMessage]);
```

### Example 8: Update Chat Description Only

```typescript
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';

async function updateChatTitle(chatId: string, newTitle: string) {
  // Update description without touching messages
  await BackendPersistenceService.updateChatDescription(chatId, newTitle);
  
  console.log(`Updated chat ${chatId} title to: ${newTitle}`);
}

// Usage
await updateChatTitle('chat-123', 'My Updated Chat Title');
```

### Example 9: Custom Serialization

```typescript
import { ChatSerializationService } from '~/lib/services/chatSerializationService';
import type { Message } from 'ai';

async function customSerialization() {
  const messages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      experimental_attachments: [
        {
          name: 'file.txt',
          contentType: 'text/plain',
          url: 'https://example.com/file.txt',
        },
      ],
    },
  ];
  
  // Serialize with metadata
  const sessionString = ChatSerializationService.serializeMessages(
    messages,
    {
      gitUrl: 'https://github.com/user/repo',
      gitBranch: 'main',
      projectId: 'chat-123',
    },
    'My Chat with Attachments'
  );
  
  console.log(`Serialized to ${sessionString.length} bytes`);
  
  // Get summary without full deserialization
  const summary = ChatSerializationService.getSessionSummary(sessionString);
  console.log(`Summary: ${summary.messageCount} messages`);
  console.log(`Last message: ${summary.lastMessagePreview}`);
  
  // Deserialize back
  const { messages: restored, metadata, description } = 
    ChatSerializationService.deserializeMessages(sessionString);
  
  console.log(`Restored ${restored.length} messages`);
  console.log(`Description: ${description}`);
  console.log(`Git branch: ${metadata?.gitBranch}`);
}
```

### Example 10: Validate Session String

```typescript
import { ChatSerializationService } from '~/lib/services/chatSerializationService';

function validateBackendData(sessionString: string) {
  const isValid = ChatSerializationService.validateSessionString(sessionString);
  
  if (isValid) {
    console.log('✅ Session string is valid');
    
    // Get summary
    const summary = ChatSerializationService.getSessionSummary(sessionString);
    console.log(`Contains ${summary.messageCount} messages`);
  } else {
    console.error('❌ Invalid session string format');
  }
  
  return isValid;
}
```

## Troubleshooting Examples

### Example 11: Check if Chat Exists in Backend

```typescript
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';
import { ChatMigrationService } from '~/lib/services/chatMigrationService';

async function checkChatLocation(chatId: string) {
  // Check backend
  const inBackend = await ChatMigrationService.isChatMigrated(chatId);
  
  // Check IndexedDB
  const db = await openDatabase();
  const inIndexedDB = db ? !!(await getMessages(db, chatId)) : false;
  
  console.log(`Chat ${chatId}:`);
  console.log(`  - In backend: ${inBackend ? '✅' : '❌'}`);
  console.log(`  - In IndexedDB: ${inIndexedDB ? '✅' : '❌'}`);
  
  if (!inBackend && inIndexedDB) {
    console.log('  → Chat needs migration');
  } else if (inBackend && inIndexedDB) {
    console.log('  → Chat is synced');
  } else if (!inBackend && !inIndexedDB) {
    console.log('  → Chat not found anywhere');
  }
}
```

### Example 12: Recover from Failed Migration

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';

async function recoverFailedMigration(chatId: string) {
  console.log(`Attempting to recover chat ${chatId}...`);
  
  // Verify current state
  const verification = await ChatMigrationService.verifyMigration(chatId);
  
  if (verification.isValid) {
    console.log('✅ Chat is already valid, no recovery needed');
    return true;
  }
  
  console.log('❌ Chat has issues, attempting re-migration...');
  console.log('Issues found:', verification.differences);
  
  // Re-migrate
  const success = await ChatMigrationService.migrateSingleChat(chatId);
  
  if (success) {
    // Verify again
    const recheck = await ChatMigrationService.verifyMigration(chatId);
    
    if (recheck.isValid) {
      console.log('✅ Recovery successful!');
      return true;
    } else {
      console.error('❌ Recovery failed, issues persist');
      return false;
    }
  } else {
    console.error('❌ Re-migration failed');
    return false;
  }
}
```

### Example 13: Compare IndexedDB vs Backend Data

```typescript
import { openDatabase, getMessages } from '~/lib/persistence/db';
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';

async function compareStorages(chatId: string) {
  // Load from IndexedDB
  const db = await openDatabase();
  const indexedDBChat = db ? await getMessages(db, chatId) : null;
  
  // Load from backend
  const backendChat = await BackendPersistenceService.loadChat(chatId);
  
  console.log('=== Storage Comparison ===');
  console.log(`Chat ID: ${chatId}`);
  console.log('');
  console.log('IndexedDB:');
  console.log(`  Messages: ${indexedDBChat?.messages.length ?? 0}`);
  console.log(`  Description: ${indexedDBChat?.description ?? 'N/A'}`);
  console.log('');
  console.log('Backend:');
  console.log(`  Messages: ${backendChat?.messages.length ?? 0}`);
  console.log(`  Description: ${backendChat?.description ?? 'N/A'}`);
  console.log('');
  
  if (indexedDBChat && backendChat) {
    const match = indexedDBChat.messages.length === backendChat.messages.length;
    console.log(`Status: ${match ? '✅ Synced' : '❌ Out of sync'}`);
  } else if (!indexedDBChat && !backendChat) {
    console.log('Status: ❌ Not found in either storage');
  } else {
    console.log('Status: ⚠️ Found in one storage only');
  }
}
```

### Example 14: Force Sync from IndexedDB to Backend

```typescript
import { openDatabase, getMessages } from '~/lib/persistence/db';
import { BackendPersistenceService } from '~/lib/services/backendPersistenceService';

async function forceSyncToBackend(chatId: string) {
  console.log(`Force syncing chat ${chatId} to backend...`);
  
  // Load from IndexedDB
  const db = await openDatabase();
  if (!db) throw new Error('IndexedDB not available');
  
  const chat = await getMessages(db, chatId);
  if (!chat) throw new Error(`Chat ${chatId} not found in IndexedDB`);
  
  // Force save to backend
  await BackendPersistenceService.saveChat(
    chat.id,
    chat.messages,
    chat.description,
    chat.metadata
  );
  
  console.log('✅ Force sync completed');
  
  // Verify
  const backendChat = await BackendPersistenceService.loadChat(chatId);
  const match = backendChat?.messages.length === chat.messages.length;
  
  console.log(`Verification: ${match ? '✅ Success' : '❌ Failed'}`);
}
```

### Example 15: Bulk Migration with Error Handling

```typescript
import { ChatMigrationService } from '~/lib/services/chatMigrationService';
import { openDatabase, getAll } from '~/lib/persistence/db';

async function bulkMigrateWithRetry(maxRetries = 3) {
  const db = await openDatabase();
  if (!db) throw new Error('Database not available');
  
  const chats = await getAll(db);
  const results = {
    total: chats.length,
    success: 0,
    failed: 0,
    errors: [] as Array<{ chatId: string; error: string }>,
  };
  
  for (const chat of chats) {
    let attempts = 0;
    let migrated = false;
    
    while (attempts < maxRetries && !migrated) {
      try {
        const isMigrated = await ChatMigrationService.isChatMigrated(chat.id);
        
        if (!isMigrated) {
          await ChatMigrationService.migrateSingleChat(chat.id);
        }
        
        migrated = true;
        results.success++;
      } catch (error) {
        attempts++;
        
        if (attempts >= maxRetries) {
          results.failed++;
          results.errors.push({
            chatId: chat.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }
  }
  
  console.log(`Migration complete: ${results.success}/${results.total} successful`);
  
  if (results.failed > 0) {
    console.error(`Failed: ${results.failed}`);
    results.errors.forEach(err => {
      console.error(`  - ${err.chatId}: ${err.error}`);
    });
  }
  
  return results;
}
```

## Integration with Existing Code

### Example 16: No Changes Needed

Your existing code continues to work without any changes:

```typescript
// Before backend persistence
import { setMessages, getMessages } from '~/lib/persistence/db';

// This code works exactly the same
async function existingChatFlow() {
  const messages = [/* your messages */];
  
  // Save (now automatically syncs to backend)
  await setMessages(db, chatId, messages);
  
  // Load (now tries backend first)
  const chat = await getMessages(db, chatId);
  
  // Everything else works the same
}
```

### Example 17: Gradual Rollout

```typescript
// Control feature with environment variable or config
const ENABLE_BACKEND_PERSISTENCE = process.env.ENABLE_BACKEND_PERSISTENCE === 'true';

// In db.ts, this flag controls the behavior
// When false: IndexedDB only (original behavior)
// When true: Hybrid storage (new behavior)
```

## Summary

The backend chat persistence system is designed to be:

✅ **Drop-in Compatible**: Existing code works unchanged
✅ **Easy to Use**: Same APIs, automatic syncing
✅ **Flexible**: Direct backend access when needed
✅ **Robust**: Comprehensive error handling
✅ **Debuggable**: Rich logging and verification tools

For more information, see:
- `BACKEND_CHAT_PERSISTENCE.md` - Complete documentation
- `BACKEND_PERSISTENCE_SUMMARY.md` - Implementation overview
- Source code with inline comments

