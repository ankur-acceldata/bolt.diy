# File Tracking Guide

## Quick Reference: Documenting File Changes

### 🚨 Critical Rule
**EVERY file you create, modify, or delete MUST be documented in the context with a clear reason why.**

---

## File Tracking Template

### For Files Created

```markdown
#### `path/to/new-file.ts`
**Purpose**: Brief description of what this file does

**Why Created**: Reason for creating this file

**Key Exports/Functions**:
- `functionName()` - What it does
- `ComponentName` - What it renders
- `CONSTANT_NAME` - What it represents
```

### For Files Modified

```markdown
#### `path/to/existing-file.ts`
**Changes Made**:
- Added new function `handleFeature()`
- Updated interface `FeatureConfig` with new properties
- Modified `existingFunction()` to support new feature
- Removed deprecated `oldFunction()`

**Why Modified**: Reason for the changes

**Lines Changed**: Lines 45-67, 123-145 (or approximate sections)
```

### For Files Deleted

```markdown
#### `path/to/old-file.ts`
**Why Deleted**: Reason for deletion
- Example: Replaced by new implementation
- Example: No longer needed after refactoring
- Example: Consolidated into another file

**Migration Path**: Where the functionality moved to (if applicable)
- Functionality moved to `path/to/new-file.ts`
- Or: No migration needed, feature removed
```

---

## Examples

### Example 1: Creating a New Component

```markdown
## Files Changed

### Files Created

#### `app/components/features/ExportButton.tsx`
**Purpose**: Button component that triggers chat export functionality with format selection

**Why Created**: Users requested ability to export chat history. Needed a dedicated UI component for this feature.

**Key Exports/Functions**:
- `ExportButton` - Main component with dropdown for format selection
- `useExportState()` - Custom hook for managing export state
- `ExportIcon` - SVG icon component for the button
```

### Example 2: Modifying Existing Code

```markdown
### Files Modified

#### `app/lib/stores/chatStore.ts`
**Changes Made**:
- Added `exportHistory` method to store
- Added `isExporting` state flag
- Updated `ChatStore` interface with new properties
- Added error handling for export failures

**Why Modified**: Export feature needs access to chat history and state management. Store is the central place for chat data.

**Lines Changed**: 
- Lines 34-38: Added new state properties
- Lines 156-189: Added exportHistory method
- Lines 245-250: Updated interface definition
```

### Example 3: Deleting Old Code

```markdown
### Files Deleted

#### `app/components/chat/LegacyExportButton.tsx`
**Why Deleted**: Replaced with new `ExportButton.tsx` that supports multiple export formats (JSON, Markdown, PDF) instead of just JSON. Old implementation was limited and not maintainable.

**Migration Path**: 
- All functionality moved to `app/components/features/ExportButton.tsx`
- New implementation adds format selection and progress tracking
- Users of this component should import from new location
```

---

## When to Document File Changes

### ✅ Always Document

1. **Creating any new file**
   - Components, utilities, services, types, etc.
   - Even small helper files

2. **Modifying existing files**
   - Adding new functions/methods
   - Changing interfaces/types
   - Updating logic
   - Refactoring code
   - Even small changes

3. **Deleting files**
   - Removing old implementations
   - Consolidating code
   - Cleaning up unused files

### 📝 What to Include

For **Created Files**:
- Full file path
- Clear purpose statement
- Why it was needed
- Main exports/functions with descriptions

For **Modified Files**:
- Full file path
- List of specific changes
- Why changes were needed
- Approximate line numbers or sections

For **Deleted Files**:
- Full file path
- Clear reason for deletion
- Where functionality moved (if applicable)
- Migration notes for other developers

---

## Best Practices

### ✅ DO

- **Be specific**: "Added `handleExport()` function" not "Updated file"
- **Explain why**: Always include the reason for the change
- **Update immediately**: Document changes as you make them
- **Include context**: Link related files and changes
- **Use clear paths**: Full relative paths from project root
- **List key exports**: Help others understand what's available
- **Note line numbers**: Helps locate changes in large files

### ❌ DON'T

- Don't say "Updated file" without details
- Don't skip documenting small changes
- Don't forget to explain why
- Don't wait until the end to document
- Don't use vague descriptions
- Don't forget about deleted files
- Don't skip migration paths for deletions

---

## File Tracking Checklist

Before considering a feature complete, verify:

- [ ] All created files are documented with purpose and why
- [ ] All modified files are documented with changes and why
- [ ] All deleted files are documented with reason and migration path
- [ ] File paths are accurate and complete
- [ ] Key exports/functions are listed for new files
- [ ] Line numbers or sections are noted for modifications
- [ ] Reasons are clear and understandable
- [ ] Related files are cross-referenced

---

## Benefits of File Tracking

### 1. **Easy Code Review**
Reviewers can quickly understand what changed and why

### 2. **Better Debugging**
When bugs appear, know exactly what files were touched

### 3. **Knowledge Transfer**
New team members can understand the codebase evolution

### 4. **Refactoring Safety**
Know what files depend on what and why they exist

### 5. **Historical Context**
Understand why decisions were made months later

### 6. **Dependency Tracking**
See how changes ripple through the codebase

---

## Quick Commands

### Find all files changed in a feature
```bash
# Look at the context documentation
cat context/feature-name/IMPLEMENTATION.md | grep -A 5 "## Files Changed"
```

### Check if a file is documented
```bash
# Search for file path in context
grep -r "path/to/file.ts" context/feature-name/
```

### List all created files for a feature
```bash
# Extract created files from documentation
grep -A 2 "### Files Created" context/feature-name/IMPLEMENTATION.md
```

---

## Remember

> **Every file change tells a story. Document the story so others can understand it.**
> 
> Good file tracking makes code maintainable, debuggable, and understandable.

---

## Integration with Git

File tracking in context documentation complements (not replaces) git commits:

| Git Commits | Context Documentation |
|-------------|----------------------|
| What changed (diff) | Why it changed |
| When it changed | Purpose and reasoning |
| Who changed it | How it fits in the feature |
| Short message | Detailed explanation |

**Use both together** for complete project history!

