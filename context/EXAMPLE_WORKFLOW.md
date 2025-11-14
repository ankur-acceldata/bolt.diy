# Example: Context-First Development Workflow

This document demonstrates the context-first development workflow with a real example.

---

## Scenario: User Asks to "Add Export Feature to Chat History"

### ❌ OLD WAY (Don't do this)

```
User: "Add export feature to chat history"
Developer: *Immediately starts coding*
- Creates export button component
- Adds export logic
- Realizes there was already a similar feature
- Discovers past issues with file formats
- Repeats the same mistakes
- No documentation of the work
```

**Problems:**
- Duplicate work
- Repeated mistakes
- No knowledge sharing
- Hard to maintain

---

## ✅ NEW WAY (Context-First)

### Step 1: Check Existing Context

```bash
# Search for related context
cd context/
grep -r "export" . --include="*.md"
grep -r "chat history" . --include="*.md"

# Check if feature folder exists
ls -la | grep "export"
ls -la | grep "chat"
```

**Findings:**
- Found `context/ui-features/` with chat-related docs
- No existing export feature documentation
- Need to create new context

### Step 2: Create Context Documentation

```bash
# Create feature folder
mkdir context/chat-export

# Copy template
cp context/CONTEXT_TEMPLATE.md context/chat-export/CHAT_EXPORT_IMPLEMENTATION.md

# Create README
cat > context/chat-export/README.md << 'EOF'
# Chat Export Feature

Documentation for exporting chat history in various formats.

## Files

- `CHAT_EXPORT_IMPLEMENTATION.md` - Implementation details and progress
EOF
```

### Step 3: Document the Plan

Edit `context/chat-export/CHAT_EXPORT_IMPLEMENTATION.md`:

```markdown
# Chat Export Feature Implementation

## Overview

Add ability to export chat history in multiple formats (JSON, Markdown, PDF).

## Status

- **Started**: 2024-11-14
- **Current Status**: Planning

## What Needs to Be Done

### High Priority
- [ ] Create export button in chat UI
- [ ] Implement JSON export
- [ ] Implement Markdown export
- [ ] Add file download functionality

### Medium Priority
- [ ] Add PDF export
- [ ] Add export options modal (date range, format selection)

## Implementation Details

### Architecture

Will create:
1. `ExportButton.tsx` - UI component in chat header
2. `exportService.ts` - Service for handling exports
3. `formatters/` - Format-specific export logic

### Technical Decisions

1. **File Format**: Start with JSON and Markdown (most requested)
2. **Library**: Use `file-saver` for downloads
3. **Location**: Add button to chat header next to settings
```

### Step 4: Start Implementation & Update Context

**After creating ExportButton component:**

```markdown
## What Was Done

### Phase 1: UI Component
- ✅ Created `ExportButton.tsx` in `app/components/chat/`
- ✅ Added button to chat header
- ✅ Created basic modal for format selection
```

**After implementing JSON export:**

```markdown
### Phase 2: Export Logic
- ✅ Created `app/lib/services/exportService.ts`
- ✅ Implemented JSON export
- 🚧 Working on Markdown export

## Files Changed

### Files Created

#### `app/components/chat/ExportButton.tsx`
**Purpose**: UI component for triggering chat exports

**Why Created**: Needed a user-facing button to initiate export functionality

**Key Exports/Functions**:
- `ExportButton` - Main component with modal for format selection
- `ExportModal` - Modal dialog for choosing export format and options

#### `app/lib/services/exportService.ts`
**Purpose**: Core service for handling chat exports in multiple formats

**Why Created**: Centralize export logic and format conversion in a reusable service

**Key Exports/Functions**:
- `exportChatAsJSON()` - Export chat history as JSON
- `exportChatAsMarkdown()` - Export chat history as Markdown
- `processInChunks()` - Helper for chunked processing of large datasets

#### `app/lib/formatters/markdownFormatter.ts`
**Purpose**: Format chat messages into Markdown structure

**Why Created**: Separate formatting logic from export service for better maintainability

**Key Exports/Functions**:
- `formatChatAsMarkdown()` - Convert chat array to Markdown string
- `formatMessage()` - Format individual message with metadata

### Files Modified

#### `app/components/chat/ChatHeader.tsx`
**Changes Made**:
- Added `ExportButton` component to header actions
- Imported export button component
- Added spacing for new button in layout

**Why Modified**: Need to integrate export button into existing chat UI

**Lines Changed**: Lines 45-52 (added button to actions section)

#### `app/types/chat.ts`
**Changes Made**:
- Added `ExportFormat` type enum
- Added `ExportOptions` interface
- Extended `ChatMessage` interface with optional `metadata` field

**Why Modified**: Type definitions needed for export functionality

**Lines Changed**: Lines 78-95 (new types added at end of file)

### Files Deleted

#### `app/components/chat/OldExportButton.tsx`
**Why Deleted**: Replaced with new `ExportButton.tsx` that supports multiple formats

**Migration Path**: Functionality moved to `app/components/chat/ExportButton.tsx` with enhanced features
```

**When encountering an issue:**

```markdown
## Issues Encountered

### Issue 1: Large Chat History Performance
**Problem**: Exporting large chat histories (>1000 messages) caused browser to freeze.

**Solution**: Implemented chunked processing:
- Process messages in batches of 100
- Use `requestIdleCallback` for non-blocking processing
- Show progress indicator during export

**Files Affected**:
- `app/lib/services/exportService.ts` - Added chunked processing
- `app/components/chat/ExportButton.tsx` - Added progress UI
```

### Step 5: Continue Updating as Work Progresses

**After completing Markdown export:**

```markdown
### Phase 2: Export Logic (Updated)
- ✅ Created `app/lib/services/exportService.ts`
- ✅ Implemented JSON export
- ✅ Implemented Markdown export
- ✅ Added chunked processing for large histories
```

**Documenting technical decisions:**

```markdown
### Technical Decisions (Updated)

3. **Markdown Format**: Using CommonMark spec
   - Each message as a section with timestamp
   - Code blocks preserved with syntax highlighting markers
   - User/Assistant clearly labeled

4. **Performance**: Chunked processing for >100 messages
   - Prevents UI freeze
   - Shows progress to user
   - Cancellable operation
```

### Step 6: Final Documentation

**When feature is complete:**

```markdown
## Status

- **Started**: 2024-11-14
- **Last Updated**: 2024-11-14
- **Current Status**: Completed

## What Was Done

### Phase 1: UI Component ✅
- ✅ Created `ExportButton.tsx`
- ✅ Added button to chat header
- ✅ Created format selection modal
- ✅ Added progress indicator

### Phase 2: Export Logic ✅
- ✅ Created export service
- ✅ Implemented JSON export
- ✅ Implemented Markdown export
- ✅ Added chunked processing
- ✅ Added error handling

### Phase 3: Testing ✅
- ✅ Tested with small chats (<10 messages)
- ✅ Tested with large chats (>1000 messages)
- ✅ Tested error scenarios

## Usage Examples

### Exporting Chat as JSON
```typescript
import { exportChatAsJSON } from '~/lib/services/exportService';

const handleExport = async () => {
  await exportChatAsJSON(chatHistory, 'my-chat.json');
};
```

### Exporting Chat as Markdown
```typescript
import { exportChatAsMarkdown } from '~/lib/services/exportService';

const handleExport = async () => {
  await exportChatAsMarkdown(chatHistory, 'my-chat.md');
};
```

## What Needs to Be Done

### Future Improvements
- [ ] Add PDF export
- [ ] Add date range filtering
- [ ] Add export templates
- [ ] Add batch export for multiple chats
```

---

## Benefits Demonstrated

### 1. **Clear Progress Tracking**
- Easy to see what's done and what's pending
- Status updates show current state

### 2. **Issue Documentation**
- Performance issue documented with solution
- Future developers won't repeat the same mistake

### 3. **Knowledge Sharing**
- Technical decisions explained
- Usage examples provided
- Architecture documented

### 4. **Easy Handoff**
- Another developer can pick up where you left off
- Clear understanding of implementation

### 5. **Historical Record**
- Why decisions were made
- What problems were encountered
- How they were solved

---

## Key Takeaways

1. **Always check context first** - Might find existing work or related issues
2. **Create context before coding** - Plan and document approach
3. **Update continuously** - Don't wait until the end
4. **Document issues and solutions** - Help future developers
5. **Include examples** - Make it easy for others to use

---

## Comparison: Time Investment

### Without Context Documentation
- Coding: 2 hours
- Debugging repeated issues: 1 hour
- Future developer figuring it out: 2 hours
- **Total team time: 5 hours**

### With Context Documentation
- Planning & initial docs: 15 minutes
- Coding: 2 hours
- Updating docs: 20 minutes
- Future developer reading docs: 10 minutes
- **Total team time: 2 hours 45 minutes**

**Time saved: 2 hours 15 minutes (45% reduction)**

Plus:
- Better code quality
- Fewer bugs
- Easier maintenance
- Better team collaboration

---

## Remember

> **The few minutes spent on documentation save hours of confusion later.**
> 
> Context-first development is not about creating more work—it's about working smarter.

