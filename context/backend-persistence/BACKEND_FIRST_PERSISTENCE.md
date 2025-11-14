# Backend-First Persistence Implementation

## Overview

This document describes the implementation of backend-first persistence for chat projects. The system now fetches data from the backend API first, then stores it in IndexedDB for the current session, ensuring that the backend is always the source of truth.

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Opens Project                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Fetch from Backend (Source of Truth)               │
│  - Call BackendPersistenceService.loadChat(projectId)       │
│  - Deserialize messages from backend session string         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Store in IndexedDB (Session Cache)                 │
│  - Save messages, description, metadata to IndexedDB        │
│  - Used for fast access during current session              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Load from IndexedDB                                │
│  - Read cached data for UI display                          │
│  - Restore snapshot (files, etc.)                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Sync Changes Back to Backend                       │
│  - On user message: sync immediately                        │
│  - On LLM response complete: sync immediately               │
│  - Never sync during LLM streaming                          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Project Loading (useChatHistory.ts)

When a user opens a project by navigating to `/chat/{projectId}`, the system:

1. **Fetches from Backend First**
   ```typescript
   const { BackendPersistenceService } = await import('~/lib/services/backendPersistenceService');
   backendData = await BackendPersistenceService.loadChat(mixedId);
   ```

2. **Stores in IndexedDB**
   ```typescript
   await setMessages(
     db,
     backendData.id,
     backendData.messages,
     backendData.id, // urlId
     backendData.description,
     backendData.timestamp,
     backendData.metadata,
   );
   ```

3. **Loads from IndexedDB for UI**
   - The UI reads from IndexedDB (which now contains fresh backend data)
   - This provides fast access and offline capability

4. **Fallback Behavior**
   - If backend fetch fails, continues with IndexedDB data
   - Logs warning but doesn't block user experience

### 2. Project List (Menu.client.tsx)

The left navigation sidebar now fetches all projects from the backend:

1. **Fetches All Projects from Backend**
   ```typescript
   const response = await fetch('/api/projects', {
     method: 'GET',
     headers: {
       'Content-Type': 'application/json',
     },
   });
   ```

2. **Transforms Backend Data**
   - Converts backend project format to `ChatHistoryItem` format
   - Ensures compatibility with existing UI components

3. **Caches in IndexedDB**
   - Stores project metadata in IndexedDB for offline access
   - Only creates new entries, doesn't overwrite existing data

4. **Fallback to IndexedDB**
   - If backend fetch fails, loads from IndexedDB
   - Provides resilience and offline capability

### 3. Backend Synchronization (Chat.client.tsx)

Changes are synced back to the backend at specific points:

1. **After User Sends Message**
   ```typescript
   useEffect(() => {
     const lastMessage = messages[messages.length - 1];
     if (messages.length > 0 && lastMessage?.role === 'user' && !isLoading && db) {
       // Sync to backend after 300ms (wait for IndexedDB update)
       setTimeout(async () => {
         await syncChatToBackend(chatData.messages, 'user-message');
       }, 300);
     }
   }, [messages, isLoading, syncChatToBackend, db]);
   ```

2. **After LLM Response Completes**
   ```typescript
   onFinish: async (message) => {
     // Wait for IndexedDB to update
     setTimeout(async () => {
       const chatData = await getMessages(db, currentChatId);
       if (chatData && chatData.messages && chatData.messages.length > 0) {
         await syncChatToBackend(chatData.messages, 'onFinish-assistant-response');
       }
     }, 500);
   }
   ```

3. **Never During Streaming**
   - The `ENABLE_BACKEND_PERSISTENCE` flag in `db.ts` is set to `false`
   - This prevents API calls during LLM streaming
   - Avoids the infinite loop issue

## API Endpoints

### GET /api/projects
Fetches all projects for the current user.

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "id": 251,
      "name": "My Project",
      "description": "Project description",
      "userId": "user@example.com",
      "dataplaneId": 45,
      "url": "project-url",
      "createdAt": "2025-09-17T09:18:57.993Z",
      "updatedAt": "2025-09-17T09:18:57.993Z",
      "enabled": true,
      "globalShared": true,
      "userSession": {
        "projectId": 251,
        "session": "serialized chat data",
        "dataplaneId": 45
      }
    }
  ]
}
```

### GET /api/projects/:id
Fetches a specific project by ID.

**Response Format:**
```json
{
  "success": true,
  "data": {
    "id": 251,
    "name": "My Project",
    "description": "Project description",
    "userSession": {
      "session": "serialized chat data"
    }
  }
}
```

### PUT /api/projects/:id
Updates a project with new data.

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "userSession": {
    "session": "serialized chat data"
  }
}
```

## Key Features

### 1. Backend as Source of Truth
- All project data is fetched from backend first
- Ensures consistency across devices and sessions
- Prevents data loss from IndexedDB clearing

### 2. IndexedDB as Session Cache
- Fast access to frequently used data
- Offline capability when backend is unavailable
- Automatic synchronization on reconnection

### 3. Graceful Degradation
- Falls back to IndexedDB if backend is unavailable
- Continues to work offline with cached data
- Syncs changes when connection is restored

### 4. Optimized Synchronization
- Only syncs at specific points (user message, LLM complete)
- Never syncs during LLM streaming
- Prevents infinite loops and excessive API calls

## Configuration

### Backend Persistence Flag
Located in `app/lib/persistence/db.ts`:

```typescript
// Feature flag to enable backend persistence
// Set to true to use backend storage, false to use IndexedDB only
// NOTE: Currently disabled to prevent API call loops during streaming
// Backend sync is handled manually in Chat.client.tsx onFinish callback
const ENABLE_BACKEND_PERSISTENCE = false;
```

**Important:** Keep this set to `false`. Backend sync is handled explicitly in `Chat.client.tsx`.

## Testing

### Test Scenarios

1. **Load Existing Project**
   - Navigate to `/chat/{projectId}`
   - Verify backend fetch logs in console
   - Verify data appears in UI
   - Check IndexedDB contains cached data

2. **Create New Chat**
   - Start new conversation
   - Send messages
   - Verify backend sync after user message
   - Verify backend sync after LLM response

3. **Offline Mode**
   - Disconnect network
   - Open project list
   - Verify fallback to IndexedDB
   - Verify projects still display

4. **Backend Sync**
   - Send user message
   - Wait for LLM response to complete
   - Check network tab for update API calls
   - Verify no calls during streaming

## Troubleshooting

### Projects Not Loading
1. Check browser console for backend fetch errors
2. Verify API endpoint is accessible
3. Check authentication headers
4. Verify project ID is valid

### Sync Not Working
1. Check `ENABLE_BACKEND_PERSISTENCE` is `false`
2. Verify `syncChatToBackend` is called in `Chat.client.tsx`
3. Check network tab for update API calls
4. Verify chatId is set correctly

### IndexedDB Issues
1. Clear IndexedDB in browser DevTools
2. Reload page to fetch fresh data from backend
3. Check browser console for IndexedDB errors

## Related Files

- `app/lib/persistence/useChatHistory.ts` - Project loading logic
- `app/components/sidebar/Menu.client.tsx` - Project list display
- `app/components/chat/Chat.client.tsx` - Backend synchronization
- `app/lib/services/backendPersistenceService.ts` - Backend API wrapper
- `app/lib/services/projectService.ts` - Project API calls
- `app/lib/persistence/db.ts` - IndexedDB operations
- `app/routes/api.projects.ts` - Projects API endpoint
- `app/routes/api.projects.$id.ts` - Single project API endpoint

## Migration Notes

### For Existing Users

Existing users with data in IndexedDB will experience:

1. **First Load After Update**
   - Backend data will be fetched
   - IndexedDB will be updated with backend data
   - Any local-only changes will be overwritten

2. **Data Consistency**
   - Backend is now the source of truth
   - Local changes must be synced to backend
   - IndexedDB is treated as a cache

3. **Offline Behavior**
   - Can still work offline with cached data
   - Changes will sync when connection restored
   - May see stale data if backend was updated elsewhere

## Future Improvements

1. **Conflict Resolution**
   - Handle conflicts between local and backend changes
   - Implement merge strategies for concurrent edits

2. **Optimistic Updates**
   - Update UI immediately, sync in background
   - Roll back on sync failure

3. **Background Sync**
   - Use Service Workers for background synchronization
   - Retry failed syncs automatically

4. **Real-time Sync**
   - WebSocket connection for real-time updates
   - Push notifications for changes from other devices

5. **Partial Sync**
   - Only sync changed messages
   - Reduce bandwidth and API calls

