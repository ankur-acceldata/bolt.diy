# Auto-Run Feature Implementation

## Overview

The Auto-Run feature enables the AI chat companion to automatically execute generated code without manual intervention, while providing robust safeguards against infinite loops and excessive resource usage.

## Key Features

### 1. Manual-First Code Execution
- **First execution must be manual** - user clicks Run button to maintain control
- AI provides clear instructions to use the Run button for initial execution
- After manual execution, AI can auto-retry on errors using `execute_and_monitor` MCP tool
- Provides execution logs and results directly in the chat

### 2. Loop Prevention System
- **Default limit**: 3 automatic executions per chat session
- **Configurable**: Users can adjust limits from 1-5 in settings
- **Session-based tracking**: Each chat conversation has its own execution counter
- **30-second cooldown**: Minimum delay between automatic executions

### 3. Error Handling & Recovery
- Failed executions return detailed logs and error messages
- AI can analyze errors and automatically fix code
- Smart retry logic with different approaches
- Graceful degradation when limits are exceeded

## Implementation Details

### MCP Tools

#### 1. `execute_and_monitor` Tool
**Location**: `/Users/ankuragarwal/src/xdp-mcp-server/src/index.ts`

**Purpose**: Execute code and monitor results (used for auto-retry only)

**Parameters**:
```json
{
  "sessionId": "string (required) - Unique session ID for tracking limits",
  "projectId": "string (required) - Project ID for code execution", 
  "dataplaneId": "string (required) - Dataplane ID for execution",
  "isEditAndRun": "boolean (optional) - Whether to edit config before running",
  "selectedTemplate": "object (optional) - Template configuration",
  "isManualTrigger": "boolean (optional) - Whether this is a manual trigger"
}
```

#### 2. `register_manual_execution` Tool
**Location**: `/Users/ankuragarwal/src/xdp-mcp-server/src/index.ts`

**Purpose**: Register that manual execution occurred, enabling auto-retry

**Parameters**:
```json
{
  "sessionId": "string (required) - Session ID to enable auto-retry for",
  "runId": "string (optional) - Run ID from manual execution",
  "success": "boolean (required) - Whether manual execution succeeded"
}
```

**Safety Features**:
- Execution counter per session (max 3 by default)
- 30-second minimum delay between executions
- Detailed error tracking and reporting
- Automatic session cleanup

### User Settings Integration

**Location**: `/Users/ankuragarwal/src/bolt.diy/app/lib/stores/settings.ts`

**New Setting**:
- `autoExecutionLimit`: Number (default: 3, range: 1-5)
- Stored in localStorage as `autoExecutionLimit`
- Accessible via `useSettings()` hook

### Chat API Integration

**Location**: `/Users/ankuragarwal/src/bolt.diy/app/routes/api.chat.ts`

**Enhancements**:
- Automatic session ID generation based on chat ID
- Current project context injection
- AI instruction policy updated with auto-run capabilities

## Usage Examples

### Manual-First Execution Flow
1. User: "Create a PySpark application to process CSV data"
2. AI: Generates PySpark code using MCP tools to discover data sources
3. AI: "Your code is ready! Please click the **Run** button to execute it."
4. User: Clicks Run button manually
5. If errors occur, AI can now auto-retry with fixes (up to 3 attempts)

### Error Recovery Example (After Manual First Run)
1. **Manual Execution**: User clicks Run, code fails with import error
2. AI: Calls `register_manual_execution(sessionId, success=false)`
3. AI: Analyzes logs: "Missing pandas import", fixes code
4. AI: Automatically calls `execute_and_monitor` for **Auto-retry 1/3**
5. **Auto-retry 1**: Runs successfully
6. Remaining auto-executions: 2/3

### Limit Reached Scenario
1. After 3 failed executions, AI receives limit reached message
2. AI explains the issue and suggests manual intervention
3. Provides clear instructions for user to:
   - Fix remaining issues manually
   - Start new chat session to reset counter
   - Use manual Run button

## Configuration

### Default Settings
- **Execution Limit**: 3 per session
- **Cooldown Period**: 30 seconds
- **Session Scope**: Per chat conversation

### User Customization
- Access via Settings > Features
- Adjustable execution limit (1-5)
- Visual indicators showing current usage (X/Y executions used)

## Safety Measures

### Infinite Loop Prevention
- Hard limit on executions per session
- Time-based cooldowns between attempts
- Duplicate error detection (stops retrying same error)

### Resource Protection
- Each execution has timeout limits
- Failed executions don't consume additional resources
- Graceful error handling and reporting

### User Control
- Clear visibility into execution counts
- Easy session reset (new chat)
- Manual override options
- Configurable limits

## Technical Architecture

### Component Integration
```
Chat Interface
    ↓ (session ID, project context)
Chat API (/api/chat.ts)
    ↓ (manual-first instruction)
AI: "Use Run button first"
    ↓ (user clicks Run)
Manual Execution
    ↓ (user reports results)
register_manual_execution MCP Tool
    ↓ (enables auto-retry)
execute_and_monitor MCP Tool
    ↓ (API call)
Bolt.DIY Backend (/api/adhoc-run)
    ↓ (execution)
Remote Dataplane
    ↓ (logs)
Log Streaming (/api/log-stream)
    ↓ (results)
AI Analysis & Auto-Retry
```

### Session Management
- Session ID derived from chat ID or generated
- Execution tracking stored in MCP server memory
- Automatic cleanup on server restart
- Per-session counters and error history

## Future Enhancements

### Planned Improvements
1. **Smart Error Categories**: Different retry strategies for different error types
2. **Execution History**: Persistent storage of execution results
3. **Performance Metrics**: Execution time and resource usage tracking
4. **Advanced Cooldowns**: Dynamic delays based on execution complexity

### Settings Expansion
1. **Custom Cooldowns**: User-configurable delay periods
2. **Error Tolerance**: Skip retries for certain error patterns
3. **Execution Profiles**: Different limits for different project types

## Troubleshooting

### Common Issues
1. **Tool Not Available**: Ensure XDP MCP server is properly configured and running
2. **Execution Failures**: Check dataplane connectivity and project sync status
3. **Limit Reached Too Quickly**: Increase execution limit in settings or start new chat

### Debug Information
- Check browser console for MCP tool invocation logs
- Review XDP server logs for execution tracking details
- Monitor network requests to `/api/adhoc-run` endpoint

## Testing

### Manual Testing Steps
1. Start new chat session
2. Request code generation (e.g., "Create a simple PySpark script")
3. Verify AI instructs user to click Run button (no automatic execution)
4. Manually click Run button in workbench
5. Report execution result to AI (success/failure)
6. If failure, verify AI can now auto-retry with `execute_and_monitor`
7. Test limit enforcement (create 3+ auto-retry errors and verify stopping)
8. Test new session reset functionality

### Integration Testing
- MCP tool registration and availability
- Session tracking and limit enforcement
- Error handling and recovery flows
- Settings persistence and retrieval

---

## Implementation Summary

This implementation successfully provides:
✅ **Manual-first execution** requiring user consent for initial code runs
✅ **Automatic error recovery** with AI-driven retry logic after manual first run
✅ **Robust loop prevention** with configurable 3-execution default limit
✅ **Error recovery system** with intelligent retry logic
✅ **User settings integration** for customizable limits
✅ **Safety measures** including cooldowns and session isolation
✅ **Seamless AI integration** through MCP tool architecture

The feature enhances the developer experience by providing intelligent error recovery while maintaining user control over initial code execution through comprehensive safety mechanisms.