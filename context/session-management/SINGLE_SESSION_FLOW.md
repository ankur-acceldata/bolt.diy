# Single Session Flow - Implementation Guide

## Overview
This document describes the implementation of single-session persistence for ongoing conversations. The system maintains one active session per project and updates it as the conversation progresses.

## Flow Diagram

```
User starts chat
    ↓
Create Project (if not exists)
    ↓
Get all sessions for project
    ↓
┌─────────────────────────┐
│ Session exists?         │
├─────────────────────────┤
│ YES → Update session    │  ← Append new messages to existing session
│ NO  → Create session    │  ← Create first session for project
└─────────────────────────┘
    ↓
Continue conversation
    ↓
┌─────────────────────────────────────────┐
│ User sends message                      │
│ → Immediate session update              │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ LLM responds (streaming)                │
│ → Wait for completion                   │
│ → Update session after stream finishes │
└─────────────────────────────────────────┘
```

## Implementation Details

### 1. Project Creation (First Message)

**File**: `app/lib/services/backendPersistenceService.ts`

```typescript
// When user starts a new chat
BackendPersistenceService.saveChat(chatId, messages, description)
  ↓
// STEP 1: Check if project exists
ProjectService.getProject(projectId)
  ↓
// If not exists, create it
ProjectService.createProject({ name, description })
```

### 2. Session Management

**File**: `app/lib/services/backendPersistenceService.ts`

```typescript
// STEP 2: Get all sessions for project
GET /api/projects/${projectId}/sessions
  ↓
// Find latest session (by updatedAt)
const latestSession = sessions.sort((a, b) => 
  new Date(b.updatedAt) - new Date(a.updatedAt)
)[0]
  ↓
// STEP 3: Serialize messages
const sessionString = ChatSerializationService.serializeMessages(messages)
  ↓
// STEP 4: Update or create session
POST /api/projects/${projectId}/sessions
{
  projectId: projectId,
  session: sessionString,
  sessionId: existingSessionId // Include if updating
}
```

### 3. User Message Flow

**File**: `app/components/chat/Chat.client.tsx`

```typescript
// When user sends a message
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  
  if (lastMessage?.role === 'user' && !isLoading) {
    // Wait for IndexedDB to update
    setTimeout(async () => {
      const chatData = await getMessages(db, currentChatId);
      await syncChatToBackend(chatData.messages, 'user-message');
    }, 300);
  }
}, [messages, isLoading]);
```

### 4. LLM Response Flow

**File**: `app/components/chat/Chat.client.tsx`

```typescript
// In useChat hook's onFinish callback
onFinish: async (message, options) => {
  // Wait for IndexedDB to update
  setTimeout(async () => {
    const chatData = await getMessages(db, currentChatId);
    await syncChatToBackend(chatData.messages, 'onFinish-assistant-response');
  }, 500);
}
```

### 5. Loading a Chat

**File**: `app/lib/persistence/useChatHistory.ts`

```typescript
// When user clicks on a project in sidebar
BackendPersistenceService.loadChat(projectId)
  ↓
// Fetch all sessions
GET /api/projects/${projectId}/sessions
  ↓
// Get latest session
const latestSession = sessions[0]
  ↓
// Deserialize messages
const { messages } = ChatSerializationService.deserializeMessages(
  latestSession.session
)
  ↓
// Store in IndexedDB for current session
setMessages(db, sessionId, messages)
  ↓
// Display chat and populate editor
```

## API Endpoints

### GET /api/projects/:id/sessions
**Purpose**: Fetch all sessions for a project

**Response**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 2033,
        "projectId": 71,
        "session": "serialized_messages_string",
        "createdAt": "2025-11-06T05:53:12.993Z",
        "updatedAt": "2025-11-06T05:56:21.783Z"
      }
    ]
  }
}
```

### POST /api/projects/:id/sessions
**Purpose**: Create or update a session

**Request Body**:
```json
{
  "projectId": 71,
  "session": "serialized_messages_string",
  "sessionId": 2033  // Optional: include when updating existing session
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 2033,
    "projectId": 71,
    "session": "serialized_messages_string",
    "updatedAt": "2025-11-06T05:56:21.783Z"
  }
}
```

## Key Points

### ✅ What We Do
1. **Create project once** - Only when starting a new chat
2. **Maintain single session** - One active session per project
3. **Update session** - Append messages to existing session
4. **Immediate user updates** - Sync after user sends message
5. **Post-stream LLM updates** - Sync after LLM completes response
6. **Backend-first loading** - Always fetch latest session from backend

### ❌ What We Don't Do
1. **No project updates for messages** - Projects are for metadata only
2. **No multiple sessions** - One session per ongoing conversation
3. **No updates during streaming** - Wait for LLM to finish
4. **No IndexedDB-first loading** - Always fetch from backend first

## Session String Format

Messages are serialized using `ChatSerializationService`:

```typescript
// Serialization
const sessionString = JSON.stringify({
  messages: messages,
  metadata: metadata,
  description: description,
  timestamp: new Date().toISOString()
});

// Deserialization
const { messages, metadata, description, timestamp } = JSON.parse(sessionString);
```

## Error Handling

### Project Creation Fails
- Log error
- Throw exception
- User sees error toast
- Chat creation aborted

### Session Update Fails
- Log error
- Don't throw (non-critical)
- Chat continues in IndexedDB
- Retry on next message

### Session Load Fails
- Log warning
- Fall back to IndexedDB
- Continue with local data
- Sync on next update

## Testing Checklist

- [ ] Create new chat → Creates project
- [ ] Send first message → Creates first session
- [ ] Send second message → Updates same session (no new session)
- [ ] LLM responds → Updates session after completion
- [ ] Click project in sidebar → Loads latest session
- [ ] Refresh page → Loads from backend
- [ ] Multiple messages → Single session updated each time
- [ ] No PUT /api/projects/:id calls for messages
- [ ] Only POST /api/projects/:id/sessions calls

## Logs to Monitor

### Good Logs (Expected)
```
[BACKEND-PERSIST] Starting chat save to session
[BACKEND-PERSIST] Using existing session { sessionId: 2033 }
[BACKEND-PERSIST] Updating session
[BACKEND-PERSIST] Session saved successfully
```

### Bad Logs (Issues)
```
ProjectService === MAKING API CALL TO PUT /api/projects/${projectId} ===
[BACKEND-PERSIST] Creating session (when should be updating)
Multiple session IDs for same project
```

## Migration Notes

### From Old System
- Old system: Updated entire project with userSession.session
- New system: Updates specific session via session API
- Backward compatible: Can read old project.userSession.session format

### Data Consistency
- IndexedDB stores session ID as chat ID
- Backend stores session under project
- Mapping: IndexedDB chatId = Backend sessionId

## Future Enhancements

### Multiple Sessions (Future)
When we implement multiple sessions per project:
1. User can create "New Session" button
2. Each session gets unique ID
3. User can switch between sessions
4. Each session maintains its own message history

### Session Management UI (Future)
- List all sessions for a project
- Rename sessions
- Delete old sessions
- Export session data
- Share sessions with team

## Troubleshooting

### Issue: Multiple PUT calls to /api/projects/:id
**Cause**: `syncBackendProjectWithIndexedDB` is updating project instead of session
**Fix**: Ensure it only updates metadata, not session data

### Issue: New session created on every message
**Cause**: Not checking for existing sessions before creating
**Fix**: Always fetch sessions first, update if exists

### Issue: Messages not persisting
**Cause**: Session update failing silently
**Fix**: Check logs for session API errors, verify session ID

### Issue: Chat loads empty
**Cause**: Session deserialization failing
**Fix**: Verify session string format, check for corruption

## Summary

The single-session flow ensures:
- ✅ One session per ongoing conversation
- ✅ Efficient updates (append only)
- ✅ No unnecessary project updates
- ✅ Proper backend synchronization
- ✅ Maintainable and scalable architecture

All conversation data flows through sessions, keeping projects clean and focused on metadata management.

