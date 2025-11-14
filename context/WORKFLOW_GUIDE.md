# Development Workflow Guide

## Quick Reference: Context-First Development

### 🚨 Critical Rule
**NEVER start working on a feature without checking/creating context documentation first!**

---

## Workflow Steps

### 1️⃣ Before Starting Any Work

```bash
# Check if context exists for the feature
cd context/
ls -la | grep "feature-name"
```

**If context exists:**
- Read the documentation
- Understand what's been done
- Review issues encountered
- Check what needs to be done next

**If context doesn't exist:**
- Proceed to step 2

### 2️⃣ Create Context Documentation

```bash
# Create feature folder
mkdir context/feature-name

# Copy template
cp context/CONTEXT_TEMPLATE.md context/feature-name/FEATURE_IMPLEMENTATION.md

# Create README
touch context/feature-name/README.md
```

**Fill in the template with:**
- Feature overview and goals
- Initial plan and architecture
- Expected challenges
- Implementation approach

### 3️⃣ During Development

**Update context documentation continuously:**

```markdown
## What Was Done
- ✅ Implemented component X
- ✅ Added API endpoint Y
- 🚧 Working on feature Z

## Issues Encountered
### Issue: [Problem description]
**Solution**: [How you fixed it]

## What Needs to Be Done
- [ ] Next task 1
- [ ] Next task 2
```

**Update frequency:**
- After completing each significant task
- When encountering and resolving issues
- When making important technical decisions
- At the end of each work session
- **After creating, modifying, or deleting any files**

**File tracking:**
```markdown
## Files Changed

### Files Created
#### `path/to/file.ts`
**Purpose**: What this file does
**Why Created**: Reason for creating it
**Key Exports**: Main functions/components

### Files Modified
#### `path/to/existing-file.ts`
**Changes Made**: List of changes
**Why Modified**: Reason for changes
**Lines Changed**: Approximate location

### Files Deleted
#### `path/to/old-file.ts`
**Why Deleted**: Reason for deletion
**Migration Path**: Where functionality moved (if applicable)
```

### 4️⃣ After Completing Work

**Final documentation update:**
- Mark all completed tasks as done
- Document final implementation details
- Note any remaining work or improvements
- Add usage examples
- Update changelog

---

## Context Folder Structure

```
context/
├── README.md                    # Main documentation index
├── CONTEXT_TEMPLATE.md          # Template for new features
├── WORKFLOW_GUIDE.md            # This file
│
├── feature-name/                # Feature-specific folder
│   ├── README.md                # Feature overview
│   └── IMPLEMENTATION.md        # Detailed implementation docs
│
└── [14 existing feature folders]
```

---

## Documentation Best Practices

### ✅ DO

- **Check context first** before starting any work
- **Create context** if it doesn't exist
- **Update continuously** as you work
- **Document issues** and their solutions
- **Track all file changes** (created, modified, deleted) with reasons
- **Include code examples** for complex implementations
- **Link related files** and components
- **Track pending work** clearly
- **Explain why** for every file change

### ❌ DON'T

- Don't start coding without checking/creating context
- Don't wait until the end to document
- Don't add markdown files to project root
- Don't skip documenting issues and solutions
- Don't forget to update "what needs to be done"
- Don't create/modify/delete files without documenting why
- Don't forget to track file changes in context documentation

---

## Example: Starting a New Feature

### Scenario: Adding a "Dark Mode Toggle" feature

```bash
# Step 1: Check if context exists
cd context/
ls -la | grep "dark-mode"  # Nothing found

# Step 2: Create context
mkdir context/dark-mode-toggle
cp CONTEXT_TEMPLATE.md context/dark-mode-toggle/DARK_MODE_IMPLEMENTATION.md

# Step 3: Document the plan
# Edit DARK_MODE_IMPLEMENTATION.md with:
# - What components need to be created
# - Where theme state will be stored
# - How it integrates with existing theme system

# Step 4: Start coding and update docs as you go

# Step 5: Update docs after each milestone
# - Component created ✅
# - State management added ✅
# - Issue with theme persistence (documented + solution)
# - Integration with settings panel ✅
# - All file changes tracked with reasons
```

---

## Quick Commands

### Check existing context
```bash
cd context/ && ls -d */
```

### Create new feature context
```bash
mkdir context/new-feature
cp context/CONTEXT_TEMPLATE.md context/new-feature/IMPLEMENTATION.md
```

### View all documentation for a feature
```bash
ls -la context/feature-name/
```

### Search for specific topic across all context
```bash
grep -r "search-term" context/
```

---

## Benefits of Context-First Development

1. **Avoid Duplicate Work**: Know what's already been done
2. **Learn from Past Issues**: Don't repeat the same mistakes
3. **Better Planning**: Understand what needs to be done
4. **Knowledge Sharing**: Team members can understand the feature
5. **Easier Debugging**: Track issues and solutions
6. **Better Handoffs**: Clear documentation for future work
7. **Historical Record**: Understand why decisions were made

---

## Remember

> **Context documentation is not optional—it's a critical part of the development process.**
> 
> Good documentation saves time, prevents bugs, and makes collaboration easier.

