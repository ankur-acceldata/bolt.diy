# Context Documentation

This directory contains all project documentation organized by feature and topic.

> **📖 New to this workflow?** Read the [`WORKFLOW_GUIDE.md`](./WORKFLOW_GUIDE.md) for a complete guide on context-first development.
> 
> **🎯 Starting a new feature?** Use the [`CONTEXT_TEMPLATE.md`](./CONTEXT_TEMPLATE.md) as your starting point.
>
> **💡 Want to see an example?** Check out [`EXAMPLE_WORKFLOW.md`](./EXAMPLE_WORKFLOW.md) for a real-world demonstration.
>
> **📁 Need to track file changes?** See [`FILE_TRACKING_GUIDE.md`](./FILE_TRACKING_GUIDE.md) for detailed file tracking guidelines.

## Directory Structure

### AI-Generated Feature Documentation

Documentation for features, fixes, and implementations created during development:

- **`backend-persistence/`** - Backend persistence implementation, chat persistence, and sync fixes
- **`logger-system/`** - Scoped logger system implementation and migration guides
- **`session-management/`** - Session-based persistence and single session flow
- **`sync-features/`** - Synchronization features and snapshot sync
- **`ui-features/`** - UI implementations (multi-tab editor, context menus, log viewer)
- **`health-checks/`** - Health check system implementation
- **`general-fixes/`** - General fixes, summaries, and miscellaneous improvements

### Core Documentation

Organized documentation for major system features:

- **`deployment/`** - Deployment configurations, base path setup, HTTPS development, and static assets
- **`api-integration/`** - API fetch interceptor and integration patterns
- **`configuration/`** - Application configuration features (auto-run, edit-run actions)
- **`theming/`** - Multi-theme system and semantic theme implementation
- **`sync-integration/`** - File synchronization with Golang API and Minio storage
- **`mcp-tools/`** - Model Context Protocol tool usage and policies
- **`project-docs/`** - General project documentation, contribution guidelines, FAQ, changelog

## Critical Workflow for Development

### Before Starting Work on ANY Feature

1. **Check Context First**: Always check if documentation exists in the appropriate context folder
   - Review what's been done
   - Understand issues encountered
   - Identify what needs to be done next
   
2. **Create Context if Missing**: If no context exists for the feature:
   - Create a new folder: `context/feature-name/`
   - Add initial documentation explaining the feature
   - Document the plan before starting implementation

3. **Continuous Documentation**: As work progresses:
   - Update the context document iteratively
   - Document what was implemented
   - Note any issues or blockers encountered
   - Update what needs to be done next
   - Include implementation details and decisions made
   - **Track ALL file changes** (created, modified, deleted) with reasons

### Guidelines for Adding Documentation

1. **Feature Documentation**: Create a new folder in `context/` for the feature (e.g., `context/new-feature/`)
2. **Add README**: Each feature folder should have a README.md explaining its contents
3. **Never use root**: All markdown documentation should be in `context/` or its subfolders
4. **Naming Convention**: Use lowercase with hyphens for folder names (e.g., `backend-persistence`)
5. **File Naming**: Use uppercase with underscores for markdown files (e.g., `FEATURE_IMPLEMENTATION.md`)

## Documentation Structure

Each feature documentation should include:
- **What was done**: Implementation details and completed work
- **Files changed**: Every file created/modified/deleted with reasons
  - File path and purpose
  - Why it was created/modified/deleted
  - Key exports/functions
  - Lines changed (for modifications)
- **Issues encountered**: Problems faced and how they were resolved
- **What needs to be done**: Pending tasks and future improvements
- **Implementation notes**: Technical decisions, patterns used, and important details

### Using the Template

A comprehensive template is available at `context/CONTEXT_TEMPLATE.md`. Use this template when creating documentation for new features. It includes sections for:
- Overview and status tracking
- Completed work and progress
- Issues and solutions
- Pending tasks and priorities
- Implementation details and architecture
- Testing and configuration
- Usage examples and changelog

## Maintenance

When working on a new feature:
1. Create a dedicated folder: `context/feature-name/`
2. Add a README.md describing the feature
3. Create initial context document before coding
4. Update documentation as work progresses
5. Update this README if introducing a new category

