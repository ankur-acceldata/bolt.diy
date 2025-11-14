# Session-Based Persistence Fix

## Overview

This document describes the comprehensive fix for session-based persistence, addressing multiple critical issues with the previous implementation.

## Problems Fixed

### 1. ❌ Projects Redirecting to Home
**Problem**: Clicking on a project in the left menu would redirect to home screen instead of loading the project.

**Root Cause**: The system was trying to load a "chat" by project ID, but projects don't have chat data directly - they have sessions.

**Solution**: Modified the loading logic to fetch sessions for a project and load the latest session.

### 2. ❌ Multiple PUT Calls Creating Unnecessary Sessions
**Problem**: Every chat update was calling `PUT /api/projects/:id`, creating unnecessary project updates and sessions.

**Root Cause**: The `BackendPersistenceService.saveChat()` was updating the entire project object every time, which the backend interpreted as creating a new session.

**Solution**: Changed to use session-specific APIs (`POST /api/projects/:id/sessions`) that properly create/update sessions without modifying the project.

### 3. ❌ No Session History
**Problem**: Each update created a new session, but there was no way to view or manage session history.

**Root Cause**: The system wasn't designed to handle multiple sessions per project.

**Solution**: Implemented session listing and loading by session ID, enabling proper session history management.

### 4. ❌ Incorrect API Usage
**Problem**: Using project update API for chat data instead of session APIs.

**Root Cause**: Misunderstanding of the backend API structure where projects contain sessions, not chat data directly.

**Solution**: Implemented proper session APIs and updated all persistence logic to use them.

## Architecture Changes

### Before (Incorrect)
```
User Action → Update Project → Backend creates new session
                ↓
         Multiple PUT /api/projects/:id calls
                ↓
         Unnecessary project updates
                ↓
         Session history lost
```

### After (Correct)
```
User Action → Create/Update Session → Backend manages session
                ↓
         POST /api/projects/:id/sessions
                ↓
         Proper session management
                ↓
         Session history preserved
```

## Implementation Details

### 1. New Session API Routes

#### File: `app/routes/api.projects.$id.sessions.ts`

**GET /api/projects/:id/sessions**
- Fetches all sessions for a project
- Returns array of sessions with chat data
- Used for displaying session history

**POST /api/projects/:id/sessions**
- Creates or updates a session
- Accepts session data with serialized messages
- Returns created/updated session

```typescript
// GET endpoint
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { id } = params;
  const result = await AcceldataService.getProjectSessions(id, request);
  return json(result, { status: result.status });
}

// POST endpoint
export async function action({ request, params }: ActionFunctionArgs) {
  const { id } = params;
  const sessionData = await request.json();
  const result = await AcceldataService.createOrUpdateSession(id, sessionData, request);
  return json(result, { status: result.status });
}
```

### 2. Updated AcceldataService

#### File: `app/lib/services/acceldataService.ts`

Added three new methods:

**getProjectSessions(projectId, request)**
- Fetches all sessions for a project
- Calls `GET /api/projects/:id/sessions`

**createUserSession(projectId, sessionData, request)**
- Creates a new session (existing method, kept for compatibility)

**createOrUpdateSession(projectId, sessionData, request)**
- Creates or updates a session
- Used by BackendPersistenceService for saving chats

```typescript
static async getProjectSessions(
  projectId: string | number,
  request?: Request,
): Promise<AcceldataApiResponse> {
  logger.info(`Fetching sessions for project ${projectId}`);
  const result = await this.call(`/api/projects/${projectId}/sessions`, {
    requestHeaders: request?.headers,
    request,
  });
  return result;
}

static async createOrUpdateSession(
  projectId: string | number,
  sessionData: any,
  request?: Request,
): Promise<AcceldataApiResponse> {
  logger.info(`Creating/updating session for project ${projectId}`);
  const result = await this.call(`/api/projects/${projectId}/sessions`, {
    method: 'POST',
    body: sessionData,
    requestHeaders: request?.headers,
    request,
  });
  return result;
}
```

### 3. Refactored BackendPersistenceService

#### File: `app/lib/services/backendPersistenceService.ts`

**saveChat() - Major Changes**
- Now saves to sessions instead of updating projects
- Accepts optional `projectId` parameter
- Creates project if it doesn't exist (without session data)
- Then creates/updates session separately
- Prevents multiple project updates

```typescript
static async saveChat(
  chatId: string,
  messages: Message[],
  description?: string,
  metadata?: IChatMetadata,
  projectId?: string, // NEW: Optional project ID
): Promise<void> {
  const targetProjectId = projectId || chatId;
  
  // Check if project exists, create if not
  if (!projectExists) {
    await ProjectService.createProject({
      name: description || 'New Chat',
      description: description || 'New Chat',
      metadata,
    });
  }
  
  // Create/update session (NOT project)
  const sessionData = {
    projectId: targetProjectId,
    session: sessionString,
  };
  
  await fetch(`/api/projects/${targetProjectId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
}
```

**loadChat() - Major Changes**
- Now fetches sessions for a project
- Loads latest session or specific session by ID
- Returns session data with projectId

```typescript
static async loadChat(projectId: string, sessionId?: string): Promise<BackendChatData | null> {
  // Fetch all sessions for the project
  const response = await fetch(`/api/projects/${projectId}/sessions`);
  const result = await response.json();
  
  const sessionsArray = result.data?.data || result.data;
  
  // Get latest session or specific session
  let targetSession;
  if (sessionId) {
    targetSession = sessionsArray.find(s => String(s.id) === String(sessionId));
  } else {
    // Get latest session by date
    targetSession = sessionsArray.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0];
  }
  
  // Deserialize and return session data
  return {
    id: String(targetSession.id),
    messages,
    description,
    timestamp,
    metadata,
    urlId: String(targetSession.id),
    projectId: String(projectId), // NEW: Include project ID
  };
}
```

**Updated BackendChatData Interface**
```typescript
export interface BackendChatData {
  id: string;
  messages: Message[];
  description?: string;
  timestamp: string;
  metadata?: IChatMetadata;
  urlId?: string;
  projectId?: string; // NEW: Track which project this session belongs to
}
```

### 4. Updated useChatHistory

#### File: `app/lib/persistence/useChatHistory.ts`

**Loading Logic Changes**
- When user clicks on a project, fetch its sessions
- Load the latest session for that project
- Store session data in IndexedDB with session ID as chat ID

```typescript
// STEP 1: Fetch sessions from backend for this project
logger.info(`🌐 Fetching sessions for project ${mixedId} from backend...`);

const { BackendPersistenceService } = await import('~/lib/services/backendPersistenceService');

// Load the latest session for this project
backendData = await BackendPersistenceService.loadChat(mixedId);

if (backendData && backendData.messages && backendData.messages.length > 0) {
  logger.info(`✅ Loaded ${backendData.messages.length} messages from backend session ${backendData.id}`);
  
  // Store backend data in IndexedDB
  // Use the session ID as the chat ID
  await setMessages(
    db,
    backendData.id, // Use session ID as chat ID
    backendData.messages,
    backendData.id, // urlId
    backendData.description,
    backendData.timestamp,
    backendData.metadata,
  );
}
```

## Data Flow

### Loading a Project

```
1. User clicks project in sidebar
   ↓
2. Navigate to /chat/:projectId
   ↓
3. useChatHistory loads
   ↓
4. Fetch sessions for project
   GET /api/projects/:projectId/sessions
   ↓
5. Get latest session from array
   ↓
6. Deserialize session data
   ↓
7. Store in IndexedDB with session ID
   ↓
8. Display chat messages
```

### Saving Chat Data

```
1. User sends message or LLM responds
   ↓
2. syncChatToBackend() called
   ↓
3. BackendPersistenceService.saveChat()
   ↓
4. Check if project exists
   ↓
5. Create project if needed (without session)
   ↓
6. Create/update session
   POST /api/projects/:projectId/sessions
   ↓
7. Session saved with serialized messages
```

## API Endpoints Used

### GET /api/projects
- Fetch all projects
- Used by sidebar to list projects

### GET /api/projects/:id
- Fetch single project details
- Used to check if project exists

### POST /api/projects
- Create new project
- Used when creating first session for new project

### GET /api/projects/:id/sessions
- **NEW**: Fetch all sessions for a project
- Returns array of sessions with chat data
- Used when loading a project

### POST /api/projects/:id/sessions
- **NEW**: Create or update a session
- Accepts session data with serialized messages
- Used when saving chat data

## Benefits

### 1. ✅ Proper Session Management
- Each chat update creates/updates a session, not the project
- Session history is preserved
- Can load specific sessions by ID

### 2. ✅ Reduced API Calls
- No more multiple PUT calls to projects
- Only POST to sessions when needed
- Project updates only when project metadata changes

### 3. ✅ Correct Data Model
- Projects contain metadata (name, description)
- Sessions contain chat data (messages, history)
- Proper separation of concerns

### 4. ✅ Session History Support
- Can fetch all sessions for a project
- Can load specific session by ID
- Foundation for session management UI

### 5. ✅ No More Redirects
- Projects load correctly
- Latest session displayed automatically
- Fallback to IndexedDB if backend unavailable

## Backend API Structure

Based on the Postman collection, the backend expects:

### Project Structure
```json
{
  "id": 251,
  "name": "My Project",
  "description": "Project description",
  "userId": "user@example.com",
  "dataplaneId": 45,
  "createdAt": "2025-11-05T...",
  "updatedAt": "2025-11-05T...",
  "enabled": true
}
```

### Session Structure
```json
{
  "id": 123,
  "projectId": 251,
  "session": "serialized chat data",
  "createdAt": "2025-11-05T...",
  "updatedAt": "2025-11-05T..."
}
```

### GET /api/projects/:id/sessions Response
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 123,
        "projectId": 251,
        "session": "...",
        "createdAt": "...",
        "updatedAt": "..."
      },
      {
        "id": 124,
        "projectId": 251,
        "session": "...",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

## Testing

### Test Scenario 1: Load Project
1. Open sidebar
2. Click on a project
3. **Expected**: Latest session loads, messages display
4. **Check**: No redirect to home, console shows session loading logs

### Test Scenario 2: Send Message
1. Open project
2. Send a message
3. Wait for LLM response
4. **Expected**: Single POST to `/api/projects/:id/sessions`
5. **Check**: No PUT to `/api/projects/:id`, network tab shows correct API call

### Test Scenario 3: Multiple Messages
1. Send multiple messages in succession
2. **Expected**: Session updates accumulate, single API call per sync point
3. **Check**: No multiple PUT calls, session history preserved

### Test Scenario 4: Session History
1. Create multiple sessions for a project
2. Reload project
3. **Expected**: Latest session loads
4. **Future**: UI to switch between sessions

## Migration Notes

### For Existing Data

Existing projects with chat data in `userSession.session` field:
- Will continue to work (backward compatible)
- New sessions will be created properly
- Old data can be migrated to sessions if needed

### For New Projects

All new projects will:
- Be created without session data
- Have sessions created separately
- Follow proper data model

## Future Enhancements

### 1. Session Management UI
- List all sessions for a project
- Switch between sessions
- Delete old sessions
- Rename sessions

### 2. Session Metadata
- Add session titles/descriptions
- Track session creation source
- Add session tags/labels

### 3. Session Sharing
- Share specific sessions
- Export session data
- Import sessions

### 4. Session Analytics
- Track session duration
- Message counts per session
- Session activity timeline

## Files Modified

1. **app/routes/api.projects.$id.sessions.ts** (NEW)
   - Session API endpoints

2. **app/lib/services/acceldataService.ts**
   - Added `getProjectSessions()`
   - Added `createOrUpdateSession()`

3. **app/lib/services/backendPersistenceService.ts**
   - Refactored `saveChat()` to use sessions
   - Refactored `loadChat()` to fetch sessions
   - Updated `BackendChatData` interface

4. **app/lib/persistence/useChatHistory.ts**
   - Updated loading logic to fetch sessions
   - Store session ID as chat ID

5. **app/components/sidebar/Menu.client.tsx**
   - Already fetching projects correctly
   - Ready for session listing (future enhancement)

## Commit Message

```
fix: Implement proper session-based persistence

This commit fixes multiple critical issues with chat persistence:

1. Projects now load correctly (no more redirect to home)
   - Fetch sessions for project instead of project data
   - Load latest session automatically
   - Store session ID as chat ID in IndexedDB

2. Fixed multiple PUT calls issue
   - Changed from updating projects to creating/updating sessions
   - Use POST /api/projects/:id/sessions instead of PUT /api/projects/:id
   - Prevents unnecessary project updates and session creation

3. Proper session management
   - Created session API routes
   - Sessions are now first-class entities
   - Can fetch all sessions for a project
   - Can load specific session by ID

4. Correct data model
   - Projects contain metadata only
   - Sessions contain chat data
   - Proper separation of concerns

Files changed:
- app/routes/api.projects.$id.sessions.ts (NEW)
- app/lib/services/acceldataService.ts
- app/lib/services/backendPersistenceService.ts
- app/lib/persistence/useChatHistory.ts

Fixes: #1 (projects redirect), #2 (multiple PUTs), #3 (no session history)
```

