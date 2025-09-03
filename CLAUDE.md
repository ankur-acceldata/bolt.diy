# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- **Start development server**: `pnpm run dev`
- **Build project**: `pnpm run build`
- **Start production build**: `pnpm run start`
- **Preview build**: `pnpm run preview`

### Testing
- **Run tests**: `pnpm test`
- **Run tests in watch mode**: `pnpm test:watch`
- **Test files pattern**: `*.spec.ts` or `*.spec.tsx`

### Code Quality
- **Run linting**: `pnpm run lint`
- **Fix linting issues**: `pnpm run lint:fix`
- **Type checking**: `pnpm run typecheck`

### Docker
- **Build Docker image**: `pnpm run dockerbuild`
- **Run Docker container**: `docker compose --profile development up`

## Architecture Overview

This is a Remix-based web application that provides an AI-powered development environment using WebContainers.

### Key Technologies
- **Framework**: Remix with Cloudflare Pages deployment
- **WebContainer**: Browser-based Node.js runtime for code execution
- **UI**: React with Radix UI components and UnoCSS
- **State Management**: Nanostores
- **AI Integration**: Multiple LLM providers (OpenAI, Anthropic, Ollama, etc.)

### Core Architecture Components

#### 1. WebContainer Integration (`app/lib/webcontainer/`)
- Provides in-browser Node.js runtime
- Handles file system operations and command execution
- Limitations: No native binaries, no pip, limited Python standard library

#### 2. Action System (`app/lib/runtime/`)
- **ActionRunner**: Executes file operations and shell commands
- **MessageParser**: Parses LLM responses for artifacts and actions
- Supports file creation, editing, and shell command execution

#### 3. Chat Interface (`app/components/chat/`)
- Main chat component handles user interactions
- Supports file attachments, voice input, and templates
- Integrates with multiple LLM providers

#### 4. Workbench (`app/components/workbench/`)
- File tree navigation
- Code editor with syntax highlighting
- Terminal emulator
- Preview panel for web applications

#### 5. LLM Integration (`app/lib/modules/llm/`)
- Provider registry system for multiple AI services
- Each provider implements a common interface
- API keys managed through UI or environment variables

### Important Design Patterns

1. **Artifact System**: LLM responses use `<boltArtifact>` tags to specify file operations
2. **Action Callbacks**: File and shell operations are parsed from LLM responses
3. **State Management**: Uses Nanostores for reactive state across components
4. **File Locking**: Prevents concurrent modifications to the same file

### Environment Variables
- LLM provider API keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.
- Custom base URLs for providers: `OLLAMA_API_BASE_URL`, `OPENAI_LIKE_API_BASE_URL`, etc.
- Supabase credentials: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### WebContainer Limitations
- Cannot run native binaries or compile C/C++ code
- Python limited to standard library only (no pip)
- No git command available
- Prefer Node.js scripts over shell scripts
- Use Vite for web servers instead of custom implementations

### Deployment Features
- Netlify deployment integration
- Vercel deployment integration
- GitHub repository integration
- Project export as ZIP

### Testing Approach
- Uses Vitest for unit tests
- Test files should be named `*.spec.ts` or `*.spec.tsx`
- Limited test coverage - mainly for critical parsers and utilities