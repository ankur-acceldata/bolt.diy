# Edit-Run Action Implementation

## Overview

This document describes the implementation of the `edit-run` workbench action, which enables the LLM to intelligently decide whether to trigger direct execution or open the configuration dialog based on whether external datastores were used during code generation.

## Problem Statement

When the LLM generates code that uses external datastores (PostgreSQL, Snowflake, S3, etc.) discovered via `xdp_list_datastores`, the user needs to review and configure datastore connections and credentials before running the application. 

**Two Key Issues:**
1. **Initial Generation**: LLM would use `action="run"` instead of `action="edit-run"`, bypassing configuration
2. **Multi-Iteration Conversations**: In subsequent iterations, even if datastores were used earlier, LLM would forget and use `action="run"` because it only checked current changes, not the entire conversation history or existing codebase

## Solution

We implemented a comprehensive solution with three components:

1. **New `edit-run` Action**: Opens the "Edit Config & Run" dialog for user configuration
2. **Conversation History Awareness**: LLM checks entire conversation for `xdp_list_datastores` usage, not just current iteration
3. **Codebase Scanning**: LLM scans ALL existing files for datastore connections, even if current changes don't touch them
4. **Detailed User Messages**: LLM provides specific, informative messages about which datastores need configuration and why

## Implementation Details

### 1. Message Parser (`app/lib/runtime/message-parser.ts`)

**Changes:**
- Added `'edit-run'` to the list of valid workbench actions
- Updated auto-execution logic to handle both `'run'` and `'edit-run'` actions
- Both actions now dispatch the `workbench-action-detected` event during streaming

```typescript
const validActions = ['run', 'edit-run', 'build', 'sync', 'deploy', 'test', 'preview', 'terminal'];

// Trigger auto-execution for run or edit-run actions during streaming
if ((action === 'run' || action === 'edit-run') && this.#isStreaming) {
  window.dispatchEvent(
    new CustomEvent('workbench-action-detected', {
      detail: { action, parameters, timestamp: Date.now() },
    }),
  );
}
```

### 2. Type Definitions (`app/types/actions.ts`)

**Changes:**
- Added `'edit-run'` to the `WorkbenchAction` interface

```typescript
export interface WorkbenchAction extends BaseAction {
  type: 'workbench-action';
  action: 'run' | 'edit-run' | 'build' | 'sync' | 'deploy' | 'test' | 'preview' | 'terminal';
  parameters?: Record<string, any>;
}
```

### 3. Workbench Component (`app/components/workbench/Workbench.client.tsx`)

**Changes:**
- Updated event handler to process both `'run'` and `'edit-run'` actions
- Added `isEditAndRun` flag based on the action type
- Pass `isEditAndRun` to `handleExecuteAdhocRun(isEditAndRun)`
- Display appropriate visual indicators based on action type

```typescript
if (action === 'run' || action === 'edit-run') {
  const isEditAndRun = action === 'edit-run';
  
  // Different visual indicators
  if (isEditAndRun) {
    runIndicator.innerHTML = `
      <div class="i-ph:gear text-xl animate-pulse"></div>
      <div class="flex-1">
        <div class="font-medium">Opening Configuration</div>
        <div class="text-sm opacity-90">Review and configure settings before running...</div>
      </div>
    `;
  }
  
  // Execute with edit-and-run flag
  await handleExecuteAdhocRun(isEditAndRun);
}
```

### 4. Tool Policy (`app/lib/common/prompts/tool-policy.ts`)

**Changes:**
- Added comprehensive guidance on when to use `edit-run` vs `run`
- Included **3-step decision matrix** for the LLM:
  1. Check conversation history for `xdp_list_datastores` usage
  2. Scan entire codebase for datastore connections
  3. Check current changes
- Added requirement to include **detailed, specific** user messages after `edit-run`
- Messages must explain: WHICH datastores, WHAT to configure, WHY it's needed, HOW to proceed

```xml
<code_generation_integration>
  WORKBENCH ACTION SELECTION (CRITICAL):
  MUST choose the correct workbench action based on MCP tool usage:
  
  ✅ USE <boltAction type="workbench-action" action="edit-run" /> WHEN:
  - You have called xdp_list_datastores MCP tool during the conversation
  - The generated code uses datastore connections (external databases, S3, Snowflake, etc.)
  - The code requires Kubernetes secret-based credentials (secretName/secretKeys in config)
  - User needs to configure datastore authentication or connection parameters
  
  ✅ USE <boltAction type="workbench-action" action="run" /> WHEN:
  - You have NOT used xdp_list_datastores
  - The code only uses Trino catalogs (discovered via trino_list_catalogs)
  - No external datastore connections are required
  - All necessary configuration is already in place
  
  CRITICAL: If you used xdp_list_datastores at ANY point during code generation, you MUST:
  1. Use action="edit-run" instead of action="run"
  2. Add a user-friendly message AFTER the workbench action explaining why edit-run is needed
  
  Example when xdp_list_datastores was used:
  ```
  <boltAction type="workbench-action" action="edit-run" />
  
  📋 **Configuration Required**: Since this application connects to external datastores (discovered via the platform), 
  you'll need to review and configure the connection settings before running. Click the **Edit Config & Run** button 
  above to verify the datastore connections and credentials, then execute the application.
  ```
</code_generation_integration>
```

### 5. System Prompts (`app/lib/common/prompts/prompts.ts`)

**Changes:**
- Updated workbench-action documentation to include `edit-run`
- Added guidance on when to use each action type
- Provided clear examples for both scenarios

```typescript
Available workbench actions:
- `run`: Execute the current project (equivalent to clicking the Run button). Use this IMMEDIATELY after generating code to test functionality.
- `edit-run`: Open configuration dialog before running (use when external datastores are involved). Opens the Edit Config & Run dialog.

CRITICAL: After generating code files, choose the appropriate action:
- Use `action="run"` for code that only uses Trino catalogs (internal data)
- Use `action="edit-run"` when code uses external datastores discovered via xdp_list_datastores
```

### 6. Python Prompt (`app/lib/common/prompts/python-prompt.ts`)

**Changes:**
- Added workbench action selection as rule #1 (highest priority)
- Included decision matrix for datastores vs catalogs
- Added example with user-friendly message for edit-run
- Updated final reminders to emphasize the distinction

```typescript
<critical_rules>
1. WORKBENCH ACTION SELECTION - Choose based on data sources:
   - Use <boltAction type="workbench-action" action="run" /> when ONLY using Trino catalogs (internal data)
   - Use <boltAction type="workbench-action" action="edit-run" /> when using external datastores (PostgreSQL, Snowflake, S3, etc.)
   - CRITICAL: If you called xdp_list_datastores during code generation, MUST use action="edit-run"
   - Add user message after edit-run explaining configuration is required
```

## Decision Flow (Enhanced with Multi-Iteration Support)

```
LLM generates code (any iteration in conversation)
    ↓
STEP 1: Check ENTIRE conversation history
    ├─ Did I call xdp_list_datastores at ANY point? 
    │   ├─ YES → Use action="edit-run" + detailed message
    │   └─ NO → Continue to Step 2
    ↓
STEP 2: Scan ALL existing code files
    ├─ Does ANY file have datastore connections?
    │   (PostgreSQL, Snowflake, S3, MongoDB, etc.)
    ├─ Are there datastore imports?
    │   (psycopg2, boto3, snowflake.connector, pymongo)
    │   ├─ YES → Use action="edit-run" + detailed message
    │   └─ NO → Continue to Step 3
    ↓
STEP 3: Check current iteration changes
    ├─ Am I adding datastore code now?
    │   ├─ YES → Use action="edit-run" + detailed message
    │   └─ NO → Use action="run"
    ↓
Action Selection:
    ├─ action="edit-run"
    │   ├─ Add detailed message (which datastores, what to configure, why, how)
    │   ├─ Message parser detects "edit-run"
    │   ├─ Workbench calls handleExecuteAdhocRun(true)
    │   └─ Opens Edit Config & Run dialog
    │
    └─ action="run"
          ├─ Message parser detects "run"
          ├─ Workbench calls handleExecuteAdhocRun(false)
          └─ Executes directly
```

## User Experience

### Scenario 1: Code Uses Only Trino Catalogs

**LLM Response:**
```xml
<boltAction type="workbench-action" action="run" />

✅ The application is ready to run and will execute automatically using the internal Trino catalogs.
```

**User Experience:**
- Code executes immediately after file sync
- Terminal shows output
- No manual configuration required

### Scenario 2: Code Uses External Datastores

**LLM Response:**
```xml
<boltAction type="workbench-action" action="edit-run" />

📋 **Configuration Required**: This application connects to external datastores that require configuration before execution.

**Datastores Used**:
- **PostgreSQL** (source): Production customer database
- **Snowflake** (target): Analytics data warehouse

**What You Need to Configure**:
1. **Database Credentials**: PostgreSQL username/password (mounted from Kubernetes secrets)
2. **Snowflake Account**: Account ID, warehouse, database, schema settings
3. **Connection Parameters**: Verify host, port, and database names are correct
4. **Authentication**: Review OAuth tokens or service account credentials

**How to Proceed**:
Click the **Edit Config & Run** button above to open the configuration dialog. The system has pre-populated 
discovered values from the XDP platform, but you should verify credentials and connection parameters before 
executing. Once configured, the application will connect to these datastores and execute the data migration.

This step is required because external datastore connections need environment-specific configuration 
(credentials are not hardcoded for security).
```

**User Experience:**
- Edit Config & Run dialog opens automatically
- User sees **specific datastores** listed with their purposes
- User reviews **detailed configuration requirements**
- User configures credentials (environment variables from K8s secrets)
- User validates connection parameters
- User clicks "Run" to execute
- Terminal shows output

## Benefits

1. **Conversation History Awareness**: LLM remembers datastore usage across multiple iterations, preventing false negatives
2. **Codebase-Wide Detection**: Scans all existing files for datastore connections, not just current changes
3. **Intelligent Decision Making**: 3-step decision matrix ensures correct action selection
4. **Better User Experience**: Users receive specific, actionable guidance about configuration requirements
5. **Clear Communication**: Messages explain WHICH datastores, WHAT to configure, WHY it's needed, HOW to proceed
6. **Consistent Behavior**: Same pattern applies across all prompts (default, Python, etc.)
7. **Backward Compatible**: Existing `run` action continues to work as before
8. **Multi-Iteration Support**: Works correctly even when code was generated 5+ iterations ago

## Testing

To test the implementation:

1. **Test with Trino Catalogs Only:**
   - Ask LLM to create a PySpark app that queries Trino catalogs
   - Verify it uses `action="run"`
   - Verify automatic execution happens
   - Verify simple "Ready to Execute" message

2. **Test with External Datastores (Initial Generation):**
   - Ask LLM to create a PySpark app that connects to PostgreSQL/Snowflake
   - Verify LLM calls `xdp_list_datastores`
   - Verify it uses `action="edit-run"`
   - Verify detailed message with specific datastores, configuration needs, and steps
   - Verify Edit Config & Run dialog opens

3. **Test Multi-Iteration with Datastores (Critical!):**
   - **Iteration 1**: Ask LLM to create app with PostgreSQL connection
   - **Iteration 2**: Ask LLM to fix a bug or add a feature (doesn't touch datastores)
   - **Verify**: LLM still uses `action="edit-run"` (remembers datastores from iteration 1)
   - **Verify**: Message still explains PostgreSQL configuration is needed
   - This tests conversation history awareness!

4. **Test Codebase Scanning:**
   - Create a project with PostgreSQL code manually
   - Ask LLM to add a new feature that doesn't touch database
   - **Verify**: LLM detects existing PostgreSQL code and uses `action="edit-run"`
   - This tests codebase scanning capability!

5. **Test Mixed Scenario:**
   - Ask LLM to migrate data from external datastore to Trino catalog
   - Verify it uses `action="edit-run"` (since datastores are involved)
   - Verify message lists both source and target datastores

## Files Modified

1. `/app/lib/runtime/message-parser.ts` - Added edit-run to valid actions, updated auto-execution
2. `/app/types/actions.ts` - Added edit-run to WorkbenchAction type
3. `/app/components/workbench/Workbench.client.tsx` - Handle edit-run action, pass flag to execution
4. `/app/lib/common/prompts/tool-policy.ts` - Added comprehensive guidance for LLM
5. `/app/lib/common/prompts/prompts.ts` - Updated workbench-action documentation
6. `/app/lib/common/prompts/python-prompt.ts` - Added Python-specific guidance and examples

## Future Enhancements

1. **Automatic Detection**: Could enhance to automatically detect datastore usage in generated code
2. **Smart Defaults**: Pre-populate configuration fields based on discovered datastore information
3. **Validation**: Validate configuration before allowing execution
4. **History**: Remember previous configurations for datastores
5. **Templates**: Provide configuration templates for common datastore types

