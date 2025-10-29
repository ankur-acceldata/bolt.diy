# Snapshot Sync Fix - File Changes Not Persisting on Reload

## Problem Description

When files were modified (either by AI or user), reloading the page would show the old version of files instead of the latest changes. This was causing data loss and confusion for both AI-generated changes AND user edits.

## Root Cause Analysis

### How Snapshots Work

1. **File Changes Flow**:
   - When files are modified, they're saved to `FilesStore` and `WebContainer`
   - The `saveFile` method in `workbench.ts` triggers a snapshot
   - Snapshots are debounced by 2 seconds to avoid creating too many snapshots during rapid changes

2. **Snapshot Storage**:
   - Snapshots are stored in IndexedDB in the `versioned_snapshots` object store
   - Each snapshot contains a complete copy of all files at that point in time
   - Snapshots are versioned and include metadata like `changeType` ('initial', 'upload', 'ai-response', 'user-edit')

3. **Page Reload Flow**:
   - When the page reloads, `useChatHistory` loads the latest snapshot from IndexedDB
   - The `restoreSnapshot` function writes all files from the snapshot to WebContainer
   - This becomes the starting state for the session

### The Bugs

There were **THREE critical bugs**:

#### Bug 1: AI Response Snapshots Not Created

1. When AI streaming completes, the `onFinish` callback in `Chat.client.tsx` was called
2. However, this callback **did NOT trigger a snapshot** for AI-generated file changes
3. The comment in `useChatHistory.ts` (line 611) claimed: "AI response snapshots are now handled in Chat.client.tsx onFinish"
4. **This was incorrect** - the `onFinish` callback only cleared the user upload state

**Result:**
- AI-generated file changes were saved to FilesStore/WebContainer
- But NO snapshot was created in IndexedDB
- If the user reloaded, the changes were lost
- On reload, the old snapshot was restored

#### Bug 2: Snapshots Not Restored on Normal Page Load

**The critical issue:** In `useChatHistory.ts`, snapshots were **ONLY restored when rewinding** (line 167: `if (startingIdx > 0)`).

For normal page loads:
1. `startingIdx` is `-1` (no rewind)
2. The `if (startingIdx > 0)` condition fails
3. **Snapshot restoration is SKIPPED entirely**
4. Files are embedded in messages as boltActions, but this relies on message parsing
5. This doesn't directly restore the workbench state

**Result:**
- Even when snapshots WERE created (for user edits), they weren't restored on normal reload
- Only the initial project state was loaded
- User edits were lost even though they were saved to IndexedDB!

#### Bug 3: ChatId Mismatch Between Save and Load ⚠️ **THE ROOT CAUSE**

**The most critical issue:** Snapshots were saved with `actualChatId` but loaded with `mixedId`!

When saving (in `workbenchStore.saveFile`):
```typescript
const mixedChatId = getCurrentChatId();           // e.g., "abc123" (URL ID)
const actualChatId = await resolveActualChatId(mixedChatId);  // e.g., "xyz789" (DB ID)
triggerSnapshot(db, actualChatId, files, 'user-edit', lastMessageId);  // Saved with actualChatId
```

When loading (in `useChatHistory.ts`):
```typescript
getLatestVersionedSnapshot(db, mixedId)  // ❌ Loading with mixedId, not actualChatId!
```

**Result:**
- Snapshots were saved to IndexedDB with key `xyz789-v2` (actualChatId)
- But we were trying to load with key `abc123-v2` (mixedId)
- **Different keys = snapshot not found!**
- System fell back to loading the initial snapshot (version 1) which was created with a different ID
- This is why you ALWAYS got the first version!

### Why This Happened

1. **AI snapshots**: Intention to centralize in `onFinish`, but implementation was never completed
2. **Snapshot restore**: The restore logic was designed for the rewind feature, but normal page loads were forgotten
3. **ChatId mismatch**: The unified project ID system introduced two IDs (URL ID vs DB ID), but snapshot loading wasn't updated
4. **Testing gap**: The rewind feature worked, so the bug wasn't caught in that flow

## The Fix

### Changes Made

#### 1. `app/components/chat/Chat.client.tsx` - Fix AI Snapshot Creation

**Added imports:**
```typescript
import { description, useChatHistory, chatId, db } from '~/lib/persistence';
import { debugProjectId, resolveActualChatId, getCurrentChatId } from '~/utils/fileLocks';
import { triggerSnapshot } from '~/lib/persistence/snapshotUtils';
```

**Updated `onFinish` callback:**
```typescript
onFinish: async (message: Message, response: any) => {
  // ... existing usage logging code ...

  /*
   * Trigger snapshot after AI response completes
   * This ensures file changes from AI are persisted to IndexedDB
   */
  if (db) {
    try {
      const mixedChatId = getCurrentChatId();
      const actualChatId = await resolveActualChatId(mixedChatId);

      // Wait for file watcher to pick up all file changes
      await new Promise((resolve) => setTimeout(resolve, 200));

      const files = workbenchStore.files.get();

      if (Object.keys(files).length > 0) {
        logger.debug(
          'DEBUG: onFinish - Triggering ai-response snapshot with',
          Object.keys(files).length,
          'files',
        );
        triggerSnapshot(db, actualChatId, files, 'ai-response', message.id);
      } else {
        logger.debug('DEBUG: onFinish - Skipping snapshot - no files to snapshot');
      }
    } catch (error) {
      logger.error('Failed to trigger snapshot after AI response:', error);
    }
  }
},
```

#### 2. `app/lib/persistence/useChatHistory.ts` - Fix ChatId Mismatch & Snapshot Restoration

**CRITICAL FIX: Resolve actualChatId before loading snapshot**

```typescript
// Lines 103-111: Resolve the chatId BEFORE loading snapshot
const actualChatIdForLoad = await resolveActualChatId(mixedId);
logger.info(`🔍 Resolved chatId for loading: ${mixedId} → ${actualChatIdForLoad}`);

Promise.all([
  getMessages(db, mixedId),
  getLatestVersionedSnapshot(db, actualChatIdForLoad),  // ✅ Use actualChatId, not mixedId!
])
```

**Critical fix: Always restore snapshots on page load, not just when rewinding**

```typescript
// Line 167-171: Always restore the latest snapshot if it exists
if (validSnapshot && validSnapshot.files && Object.keys(validSnapshot.files).length > 0) {
  logger.info(`📦 Restoring snapshot with ${Object.keys(validSnapshot.files).length} files`);
  restoreSnapshot(mixedId, validSnapshot);
}
```

**Also restore snapshots for empty chats:**

```typescript
// Lines 256-260: Even for empty chats, restore snapshot if it exists
if (snapshot && snapshot.files && Object.keys(snapshot.files).length > 0) {
  logger.info(`📦 Restoring snapshot for empty chat with ${Object.keys(snapshot.files).length} files`);
  restoreSnapshot(mixedId, snapshot);
}
```

**Removed duplicate/incorrect restore call:**
- Line 246: Removed `restoreSnapshot(mixedId)` that was called without passing the snapshot

**Updated comments to accurately reflect the behavior:**
```typescript
/*
 * Only take snapshot if this is a new message being added, not during page load
 * Skip ALL snapshots during AI streaming since AI response snapshots are handled in Chat.client.tsx onFinish
 * This prevents duplicate snapshots during streaming
 */
if (!isInitialLoad && messages.length > initialMessages.length) {
  const isCurrentlyStreaming = streamingState.get();

  /*
   * Skip snapshot creation only during active AI streaming
   * AI response snapshots are triggered in Chat.client.tsx onFinish callback after streaming completes
   * This allows snapshots for user imports (like folder uploads) even if they create assistant messages
   */
  if (!isCurrentlyStreaming) {
    // ... snapshot logic ...
  }
}
```

## How It Works Now

### Complete Flow After Fix

1. **AI Streaming Starts**:
   - `streamingState` is set to `true`
   - File actions are executed as they stream in
   - Files are saved to FilesStore and WebContainer
   - NO snapshots are created during streaming (to avoid performance issues)

2. **AI Streaming Completes**:
   - `onFinish` callback is triggered
   - `streamingState` is still `true` at this point
   - The callback waits 200ms for file watcher to pick up all changes
   - Gets the current files from `workbenchStore.files`
   - Triggers a snapshot with `changeType: 'ai-response'`
   - The snapshot is debounced (2 seconds) and then saved to IndexedDB

3. **Snapshot Creation**:
   - `triggerSnapshot` debounces the request
   - After 2 seconds, it creates a versioned snapshot
   - The snapshot includes ALL files (full snapshot, not delta)
   - Snapshot is saved to IndexedDB with version number and metadata

4. **Page Reload**:
   - `useChatHistory` loads the latest snapshot from IndexedDB
   - `restoreSnapshot` writes all files to WebContainer
   - User sees the latest version of all files

### User Edits Flow

User edits are **already working correctly** and were not affected by the bug. Here's the complete flow:

1. **User types in CodeMirror editor**:
   - Changes are debounced (150ms) in `CodeMirrorEditor.tsx`
   - `onChange` callback is triggered with the new content
   - This updates the `EditorStore` via `updateFile()`

2. **User saves the file** (Cmd+S or auto-save):
   - `onFileSave` callback in `Workbench.client.tsx` is triggered
   - Calls `workbenchStore.saveCurrentDocument()`
   - Which calls `workbenchStore.saveFile(filePath, skipSnapshot=false)`

3. **`saveFile` method in `workbench.ts`** (lines 359-410):
   - Gets the document content from EditorStore
   - Calls `filesStore.saveFile()` to write to WebContainer
   - Updates unsavedFiles set
   - **Triggers snapshot** with `changeType: 'user-edit'`
   - Uses the last message ID as the snapshot reference

4. **Snapshot is created**:
   - `triggerSnapshot()` is called with all current files
   - After 2-second debounce, snapshot is saved to IndexedDB
   - Snapshot includes ALL files (full snapshot)

**Key difference from AI edits:**
- User edits: Snapshot triggered in `workbenchStore.saveFile()` ✅ (already working)
- AI edits: Snapshot was NOT triggered in `onFinish` ❌ (fixed by this PR)

## Visual Flow Comparison

### Before Fix (AI Edits Were Lost)

```
AI Response → Files Saved → WebContainer Updated → ❌ NO SNAPSHOT
                                                   ↓
                                            Page Reload
                                                   ↓
                                      Load OLD snapshot from IndexedDB
                                                   ↓
                                         ❌ OLD FILES RESTORED
```

### After Fix (AI Edits Persisted)

```
AI Response → Files Saved → WebContainer Updated → onFinish Triggered
                                                   ↓
                                            Snapshot Created
                                                   ↓
                                        Saved to IndexedDB (2s debounce)
                                                   ↓
                                            Page Reload
                                                   ↓
                                      Load LATEST snapshot from IndexedDB
                                                   ↓
                                         ✅ LATEST FILES RESTORED
```

### User Edits (Always Worked)

```
User Types → Editor Updated → User Saves (Cmd+S)
                                    ↓
                            workbenchStore.saveFile()
                                    ↓
                            Files Saved to WebContainer
                                    ↓
                            Snapshot Triggered (user-edit)
                                    ↓
                        Saved to IndexedDB (2s debounce)
                                    ↓
                            Page Reload
                                    ↓
                      Load LATEST snapshot from IndexedDB
                                    ↓
                         ✅ LATEST FILES RESTORED
```

## Testing

To verify the fix works:

1. **Test AI-generated changes**:
   - Ask AI to create or modify files
   - Wait for AI response to complete
   - Check browser console for: "DEBUG: onFinish - Triggering ai-response snapshot with X files"
   - Reload the page immediately
   - Verify files show the latest changes

2. **Test user edits**:
   - Manually edit a file in the editor
   - Save the file (Cmd+S or auto-save)
   - Reload the page
   - Verify changes are persisted

3. **Test rapid changes**:
   - Make multiple rapid changes
   - Verify only one snapshot is created (debouncing works)
   - Reload and verify latest state is preserved

## Benefits

1. **Data Integrity**: File changes are now reliably persisted to IndexedDB
2. **No Data Loss**: Reloading the page always shows the latest file state
3. **Performance**: Debouncing prevents excessive snapshot creation
4. **Proper Separation**: AI response snapshots are handled separately from user edits
5. **Better Logging**: Debug logs help track snapshot creation

## Related Files

- `app/components/chat/Chat.client.tsx` - AI response handling and snapshot triggering
- `app/lib/persistence/useChatHistory.ts` - Message history and snapshot coordination
- `app/lib/persistence/snapshotUtils.ts` - Snapshot creation and management
- `app/lib/stores/workbench.ts` - File saving and user edit snapshots
- `app/lib/stores/files.ts` - File storage and management
- `app/lib/persistence/db.ts` - IndexedDB operations

## Summary of Both Fixes

### Before Fixes
```
User Edit → Save Button → Snapshot Created → IndexedDB ✅
                                              ↓
                                        Page Reload
                                              ↓
                                    ❌ Snapshot NOT Restored
                                              ↓
                                    Initial state loaded

AI Response → Files Saved → ❌ NO Snapshot Created
                                              ↓
                                        Page Reload
                                              ↓
                                    Old snapshot loaded
```

### After Fixes
```
User Edit → Save Button → Snapshot Created → IndexedDB ✅
                                              ↓
                                        Page Reload
                                              ↓
                                    ✅ Snapshot Restored
                                              ↓
                                    Latest files loaded

AI Response → Files Saved → ✅ Snapshot Created → IndexedDB ✅
                                              ↓
                                        Page Reload
                                              ↓
                                    ✅ Snapshot Restored
                                              ↓
                                    Latest files loaded
```

### Key Points

1. **Bug 1 (AI)**: Snapshots weren't being created after AI responses completed
   - **Fix**: Added snapshot trigger in `onFinish` callback
   
2. **Bug 2 (Restore)**: Snapshots weren't being restored on normal page loads
   - **Fix**: Always restore snapshots, not just when rewinding
   
3. **Bug 3 (ChatId Mismatch)**: ⚠️ **THE ROOT CAUSE** - Snapshots saved with `actualChatId` but loaded with `mixedId`
   - **Fix**: Resolve `actualChatId` before loading snapshot
   - **This was why you ALWAYS got the first version!**
   
4. **Impact**: Both user edits AND AI changes now persist correctly across page reloads

## Future Improvements

1. **Reduce Debounce Time**: Consider reducing from 2 seconds to 1 second for faster persistence
2. **Immediate Snapshot Option**: Add ability to force immediate snapshot for critical changes
3. **Snapshot Compression**: Consider compressing large snapshots to save storage
4. **Snapshot Cleanup**: Implement automatic cleanup of old snapshots to prevent IndexedDB bloat
5. **Visual Feedback**: Show user when snapshot is being created/saved
6. **Auto-save for User Edits**: Consider adding auto-save (every 5-10 seconds) so users don't have to click Save

