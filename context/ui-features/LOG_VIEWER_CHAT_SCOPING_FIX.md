# Log Viewer Chat Scoping Fix

## Problem

When opening log viewers in one chat and then starting a new chat, the log viewer would automatically open with all the same tabs from the previous chat. This was incorrect behavior - each chat session should have its own independent log viewer state.

### User Report

> "when i am on a chat and open log viewer (1 or multiple tabs in log viewer)
> then when i start a new chat, it automatically opens the log viewer on that chat and all the same tabs comes in new chat as well
> this should not happen"

## Root Cause

The log viewer state was being scoped to **`projectId`** only, but it should have been scoped to **`chatId`** (session ID).

### Before (Incorrect)

```typescript
// In LogViewerStore
import { getProjectId } from '~/utils/fileLocks';

private _getStorageKey(): string {
  const projectId = getProjectId();
  return `${STORAGE_KEY_PREFIX}_${projectId}`;  // ❌ Same for all chats in a project
}
```

**Result:**
- All chats in the same project shared the same log viewer state
- Opening log viewers in Chat A would show in Chat B
- localStorage key: `bolt_log_viewer_state_project123`
- ❌ Not session-specific

### Architecture Issue

```
Project 123
├── Chat Session A (sessionId: abc)  ─┐
├── Chat Session B (sessionId: def)  ─┤─── All share same log viewer state
└── Chat Session C (sessionId: ghi)  ─┘     (scoped to project only)
```

## Solution

Changed the scoping from `projectId` to `chatId` (session ID) to ensure each chat session has its own independent log viewer state.

### After (Correct)

```typescript
// In LogViewerStore
import { getCurrentChatId } from '~/utils/fileLocks';

private _getStorageKey(): string {
  const chatId = getCurrentChatId();
  return `${STORAGE_KEY_PREFIX}_${chatId}`;  // ✅ Unique per chat session
}
```

**Result:**
- Each chat session has its own log viewer state
- Opening log viewers in Chat A does NOT affect Chat B
- localStorage keys:
  - Chat A: `bolt_log_viewer_state_abc`
  - Chat B: `bolt_log_viewer_state_def`
  - Chat C: `bolt_log_viewer_state_ghi`
- ✅ Session-specific

### New Architecture

```
Project 123
├── Chat Session A (sessionId: abc)  ─── Log Viewer State A
├── Chat Session B (sessionId: def)  ─── Log Viewer State B
└── Chat Session C (sessionId: ghi)  ─── Log Viewer State C

Each session maintains independent log viewer state
```

## Implementation Changes

### 1. Changed Import

**File:** `app/lib/stores/logViewer.ts`

```diff
- import { getProjectId } from '~/utils/fileLocks';
+ import { getCurrentChatId } from '~/utils/fileLocks';
```

### 2. Updated Storage Key Method

```typescript
/**
 * Get storage key scoped to current chat ID (session)
 * Each chat session should have its own log viewer state
 */
private _getStorageKey(): string {
  const chatId = getCurrentChatId();
  return `${STORAGE_KEY_PREFIX}_${chatId}`;
}
```

### 3. Updated Load Method

```typescript
/**
 * Load persisted state from localStorage for current chat session
 */
private _loadPersistedState(): PersistedLogViewerState {
  // ... browser check ...
  
  try {
    const storageKey = this._getStorageKey();
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      const parsed = JSON.parse(stored) as PersistedLogViewerState;
      const chatId = getCurrentChatId();
      logger.info(`Loaded persisted log viewer state for chat ${chatId}`);
      return parsed;
    }
  } catch (error) {
    logger.error('Failed to load persisted log viewer state:', error);
  }

  // Return default state (empty)
  return {
    showLogViewerPanel: false,
    logViewerInstances: [],
    activeLogViewerId: null,
    autoSendEnabled: false,
  };
}
```

### 4. Updated Persist Method

```typescript
/**
 * Persist current state to localStorage for current chat session
 */
private _persistState(): void {
  // ... browser check ...
  
  try {
    const storageKey = this._getStorageKey();
    const state: PersistedLogViewerState = {
      showLogViewerPanel: this.showLogViewerPanel.get(),
      logViewerInstances: this.logViewerInstances.get(),
      activeLogViewerId: this.activeLogViewerId.get(),
      autoSendEnabled: this.autoSendEnabled.get(),
    };

    localStorage.setItem(storageKey, JSON.stringify(state));

    const chatId = getCurrentChatId();
    logger.debug(`Persisted log viewer state for chat ${chatId}`);
  } catch (error) {
    logger.error('Failed to persist log viewer state:', error);
  }
}
```

### 5. Added Chat ID Change Detection

**Critical Addition:** Detect when the user navigates to a different chat and reload the appropriate state.

```typescript
constructor() {
  // ... existing initialization ...

  // Listen for chat ID changes to reload state for new chat
  if (typeof window !== 'undefined') {
    let lastChatId = getCurrentChatId();

    // Use MutationObserver to detect URL changes (for SPA navigation)
    const observer = new MutationObserver(() => {
      const currentChatId = getCurrentChatId();

      if (currentChatId !== lastChatId) {
        logger.info(`Chat ID changed from ${lastChatId} to ${currentChatId}, reloading log viewer state`);
        lastChatId = currentChatId;
        this._reloadStateForNewChat();
      }
    });

    observer.observe(document, { subtree: true, childList: true });
  }

  logger.info('LogViewerStore initialized with persisted state:', persistedState);
}

/**
 * Reload log viewer state when chat ID changes
 * This ensures each chat session has its own independent log viewer state
 */
private _reloadStateForNewChat(): void {
  const newState = this._loadPersistedState();
  
  this.showLogViewerPanel.set(newState.showLogViewerPanel);
  this.logViewerInstances.set(newState.logViewerInstances);
  this.activeLogViewerId.set(newState.activeLogViewerId);
  this.autoSendEnabled.set(newState.autoSendEnabled);

  logger.info('Reloaded log viewer state for new chat:', newState);
}
```

### 6. Updated Clear Method

```typescript
/**
 * Clear persisted state from localStorage for current chat session
 */
clearPersistedState(): void {
  try {
    const storageKey = this._getStorageKey();
    localStorage.removeItem(storageKey);

    const chatId = getCurrentChatId();
    logger.info(`Cleared persisted log viewer state for chat ${chatId}`);
  } catch (error) {
    logger.error('Failed to clear persisted log viewer state:', error);
  }
}
```

## How It Works Now

### Scenario 1: Opening Log Viewers in Chat A

```
1. User is in Chat A (chatId: abc)
   ↓
2. User triggers adhoc run
   ↓
3. Log viewer instance created
   ↓
4. State persisted to: bolt_log_viewer_state_abc
   ↓
5. localStorage: { 
     showLogViewerPanel: true,
     logViewerInstances: [{ id: "...", runId: "169", ... }],
     activeLogViewerId: "...",
     autoSendEnabled: false
   }
```

### Scenario 2: Starting New Chat (Chat B)

```
1. User clicks "New Chat" or navigates to /chat/def
   ↓
2. URL changes from /chat/abc to /chat/def
   ↓
3. MutationObserver detects URL change
   ↓
4. getCurrentChatId() returns "def" (different from "abc")
   ↓
5. _reloadStateForNewChat() called
   ↓
6. Loads state from: bolt_log_viewer_state_def
   ↓
7. State is empty (new chat, no log viewers yet)
   ↓
8. Log viewer panel closed, no instances
   ↓
9. ✅ Clean slate for new chat!
```

### Scenario 3: Returning to Chat A

```
1. User navigates back to Chat A (/chat/abc)
   ↓
2. MutationObserver detects URL change
   ↓
3. getCurrentChatId() returns "abc"
   ↓
4. _reloadStateForNewChat() called
   ↓
5. Loads state from: bolt_log_viewer_state_abc
   ↓
6. State restored: { 
     showLogViewerPanel: true,
     logViewerInstances: [{ id: "...", runId: "169", ... }],
     ...
   }
   ↓
7. ✅ Log viewer restored with previous state!
```

## Benefits

### 1. ✅ Session Isolation

Each chat session has completely independent log viewer state:

```
Chat A: 3 log viewers open (Run-169, Run-173, Run-180)
Chat B: 0 log viewers (clean slate)
Chat C: 1 log viewer open (Run-200)
```

### 2. ✅ State Persistence Per Chat

Switching between chats preserves their individual states:

```
Chat A → Chat B → Chat A
  ↓        ↓        ↓
3 viewers  0 viewers  3 viewers (restored)
```

### 3. ✅ No Cross-Chat Pollution

Log viewers from one chat never appear in another:

```
Before Fix:
Chat A: Open Run-169, Run-173
Chat B: 😱 Run-169, Run-173 appear automatically (WRONG)

After Fix:
Chat A: Open Run-169, Run-173
Chat B: ✅ Empty (CORRECT)
```

### 4. ✅ Proper localStorage Management

Each chat has its own localStorage entry:

```javascript
// localStorage contents
{
  "bolt_log_viewer_state_abc": { /* Chat A state */ },
  "bolt_log_viewer_state_def": { /* Chat B state */ },
  "bolt_log_viewer_state_ghi": { /* Chat C state */ }
}
```

## Testing Scenarios

### Test 1: New Chat Isolation

```
1. Open Chat A
2. Trigger 2 adhoc runs → 2 log viewers open
3. Click "New Chat" → Navigate to Chat B
4. ✅ Verify: No log viewers in Chat B
5. ✅ Verify: Log viewer panel is closed
```

### Test 2: State Restoration

```
1. Open Chat A
2. Trigger 2 adhoc runs → 2 log viewers open
3. Navigate to Chat B (empty)
4. Navigate back to Chat A
5. ✅ Verify: 2 log viewers still open
6. ✅ Verify: Same runIds (169, 173)
7. ✅ Verify: Active tab preserved
```

### Test 3: Multiple Chats

```
1. Chat A: Open 3 log viewers
2. Chat B: Open 1 log viewer
3. Chat C: Open 0 log viewers
4. Switch between chats
5. ✅ Verify: Each chat maintains its own state
6. ✅ Verify: No cross-contamination
```

### Test 4: Page Reload

```
1. Open Chat A with 2 log viewers
2. Reload page (F5)
3. ✅ Verify: Still in Chat A
4. ✅ Verify: 2 log viewers restored
5. Navigate to Chat B
6. Reload page (F5)
7. ✅ Verify: Still in Chat B
8. ✅ Verify: Empty log viewer state
```

### Test 5: Auto-Send State

```
1. Chat A: Enable auto-send
2. Navigate to Chat B
3. ✅ Verify: Auto-send is OFF in Chat B (fresh state)
4. Enable auto-send in Chat B
5. Navigate back to Chat A
6. ✅ Verify: Auto-send is still ON in Chat A
```

## Debug Logging

All operations are logged for debugging:

```javascript
// When chat changes
logger.info(`Chat ID changed from abc to def, reloading log viewer state`);

// When state is loaded
logger.info(`Loaded persisted log viewer state for chat def`);

// When state is persisted
logger.debug(`Persisted log viewer state for chat def`);

// When state is reloaded
logger.info('Reloaded log viewer state for new chat:', newState);
```

Check browser console to verify:
1. Chat ID changes are detected
2. State is loaded for correct chat
3. State is persisted to correct key

## localStorage Inspection

To inspect the state in browser DevTools:

```javascript
// Get current chat's state
const chatId = getCurrentChatId();
const key = `bolt_log_viewer_state_${chatId}`;
const state = JSON.parse(localStorage.getItem(key));
console.log('Current chat log viewer state:', state);

// Get all log viewer states
Object.keys(localStorage)
  .filter(key => key.startsWith('bolt_log_viewer_state_'))
  .forEach(key => {
    console.log(key, JSON.parse(localStorage.getItem(key)));
  });
```

## Comparison with FilesStore

This implementation follows the same pattern as `FilesStore` for consistency:

```typescript
// FilesStore (existing pattern)
if (typeof window !== 'undefined') {
  let lastChatId = getCurrentChatId();

  const observer = new MutationObserver(() => {
    const currentChatId = getCurrentChatId();

    if (currentChatId !== lastChatId) {
      logger.info(`Chat ID changed from ${lastChatId} to ${currentChatId}, reloading locks`);
      lastChatId = currentChatId;
      this.#loadLockedFiles(currentChatId);
    }
  });

  observer.observe(document, { subtree: true, childList: true });
}

// LogViewerStore (new implementation - same pattern)
if (typeof window !== 'undefined') {
  let lastChatId = getCurrentChatId();

  const observer = new MutationObserver(() => {
    const currentChatId = getCurrentChatId();

    if (currentChatId !== lastChatId) {
      logger.info(`Chat ID changed from ${lastChatId} to ${currentChatId}, reloading log viewer state`);
      lastChatId = currentChatId;
      this._reloadStateForNewChat();
    }
  });

  observer.observe(document, { subtree: true, childList: true });
}
```

## Summary

### Problem
- Log viewer state was shared across all chats in a project
- Opening log viewers in one chat would show in all other chats

### Solution
- Changed scoping from `projectId` to `chatId` (session ID)
- Added chat ID change detection with MutationObserver
- Each chat session now has independent log viewer state

### Result
- ✅ Each chat has its own log viewer state
- ✅ State persists per chat session
- ✅ No cross-chat pollution
- ✅ Proper state restoration when switching chats
- ✅ Clean slate for new chats

The log viewer now behaves correctly, with each chat session maintaining its own independent set of log viewers! 🎉


