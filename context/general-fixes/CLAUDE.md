# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- **Start development server**: `pnpm run dev`
  - With HMR disabled: `pnpm run dev:no-hmr`
- **Build project**: `pnpm run build`
- **Start production build**: `pnpm run start`
- **Preview build**: `pnpm run preview`
- **Type checking**: `pnpm run typecheck`
- **Type generation for Wrangler**: `pnpm run typegen`

### Testing
- **Run all tests**: `pnpm test`
- **Run tests in watch mode**: `pnpm test:watch`
- Test files should follow patterns: `*.spec.ts` or `*.spec.tsx`

### Code Quality
- **Lint code**: `pnpm run lint`
- **Fix linting issues**: `pnpm run lint:fix`

### Docker
- **Build development image**: `pnpm run dockerbuild` or `docker build . --target bolt-ai-development`
- **Build production image**: `pnpm run dockerbuild:prod` or `docker build . --target bolt-ai-production`
- **Run development with Docker Compose**: `docker compose --profile development up`
- **Run production with Docker Compose**: `docker compose --profile production up`

### Electron (Desktop App)
- **Build main process**: `pnpm electron:build:main`
- **Build preload script**: `pnpm electron:build:preload`
- **Build renderer**: `pnpm electron:build:renderer`
- **Build for macOS**: `pnpm electron:build:mac`
- **Build for Windows**: `pnpm electron:build:win`
- **Build for Linux**: `pnpm electron:build:linux`

### Deployment
- **Deploy to Cloudflare Pages**: `pnpm run deploy`

## Architecture Overview

bolt.diy is a Remix-based web application that provides an AI-powered full-stack development environment running directly in the browser using WebContainers.

### Tech Stack
- **Framework**: Remix v2 with Vite and Cloudflare Pages deployment
- **WebContainer**: Browser-based Node.js runtime (StackBlitz technology)
- **UI**: React 18 with Radix UI components, UnoCSS for styling
- **State Management**: Nanostores for reactive state
- **AI Integration**: Vercel AI SDK with 18+ LLM providers (OpenAI, Anthropic, Ollama, Google, etc.)
- **Code Editor**: CodeMirror 6 with language support for 20+ languages
- **Terminal**: xterm.js for terminal emulation

## Core Architecture

### 1. WebContainer System (`app/lib/webcontainer/`)

WebContainer provides an in-browser Node.js environment that:
- Runs Node.js applications without a backend server
- Provides a virtual file system
- Executes shell commands
- Serves web previews

**Key limitations to be aware of:**
- Cannot run native binaries or compile C/C++
- Python is limited to standard library only (no pip)
- No git command available in the container
- Prefer Node.js-based tooling over system commands
- Use Vite for web servers instead of custom HTTP implementations

### 2. LLM Provider System (`app/lib/modules/llm/`)

The application uses a provider registry pattern for LLM integration:
- **Base Provider** (`base-provider.ts`): Common interface all providers implement
- **Manager** (`manager.ts`): Handles provider lifecycle and model selection
- **Registry** (`registry.ts`): Registers available providers
- **Providers**: Individual implementations for 18+ AI services

Each provider can be configured with:
- API keys (via UI or environment variables)
- Custom base URLs (for local models like Ollama, LM Studio)
- Model-specific parameters

### 3. Message Parser & Action Runner (`app/lib/runtime/`)

**Message Parser** (`message-parser.ts`):
- Parses streaming LLM responses
- Extracts structured actions from `<boltArtifact>` and `<boltAction>` tags
- Handles file operations and shell commands

**Action Runner** (`action-runner.ts`):
- Executes parsed actions in the WebContainer
- Manages action lifecycle (pending → running → complete/failed)
- Handles file writes, shell commands, and deployments
- Provides abort capabilities for long-running operations

**Artifact System**: LLM responses use XML-like tags to specify operations:
```xml
<boltArtifact id="artifact-id" title="Title">
  <boltAction type="file" filePath="/path/to/file.js">
    // file content
  </boltAction>
  <boltAction type="shell">
    npm install
  </boltAction>
</boltArtifact>
```

### 4. State Management (`app/lib/stores/`)

Uses Nanostores (19 store files) for reactive state:
- **chat.ts**: Chat messages and conversation state
- **workbench.ts**: File tree, editor state, terminal
- **editor.ts**: Editor documents and modifications
- **files.ts**: File system operations
- **settings.ts**: User preferences and configuration
- **terminal.ts**: Terminal instance management
- **theme.ts**: UI theming
- **mcp.ts**: Model Context Protocol integration

### 5. Component Architecture (`app/components/`)

**Main component groups:**
- **chat/**: Chat interface, message rendering, input handling
- **workbench/**: File tree, code editor, terminal, preview panel
- **editor/**: CodeMirror integration with syntax highlighting
- **sidebar/**: Navigation and history
- **header/**: Model selection, settings access
- **ui/**: Reusable UI components (Radix UI-based)
- **@settings/**: Settings panels and configuration
- **git/**: Git operations and repository management
- **deploy/**: Netlify/Vercel deployment integrations

### 6. Prompt Library (`app/lib/common/prompt-library.ts`)

Multiple specialized system prompts:
- **Default**: Fine-tuned general-purpose prompt
- **Optimized**: Experimental low-token usage variant
- **Java**: Specialized for Spring Boot, Maven/Gradle, enterprise Java
- **Python**: Specialized for Python apps, data processing, PySpark

Each prompt is aware of WebContainer limitations and provides appropriate guidance to LLMs.

### 7. Route Structure (`app/routes/`)

- **_index.tsx**: Main application entry point
- **chat.$id.tsx**: Individual chat session
- **git.tsx**: Git operations interface
- **webcontainer.preview.$id.tsx**: Preview window for running apps
- **webcontainer.connect.$id.tsx**: WebContainer connection endpoint

## Important Configuration

### Environment Variables

The application supports numerous environment variables for LLM providers:
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.
- Base URLs: `OLLAMA_API_BASE_URL`, `OPENAI_LIKE_API_BASE_URL`, `LMSTUDIO_API_BASE_URL`
- Supabase: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- GitHub: `VITE_GITHUB_ACCESS_TOKEN`, `VITE_GITHUB_TOKEN_TYPE`
- Debug: `VITE_LOG_LEVEL=debug`
- Context: `DEFAULT_NUM_CTX` for Ollama models

### Base Path Support

The application supports deployment at custom base paths:
- Configure via `BASE_PATH` or `VITE_BASE_PATH` environment variable
- Default: `/ai-editor`
- Vite config handles proxy and asset path rewrites

### HMR Control

Hot Module Replacement is **disabled by default**:
- HMR is disabled by default for stability in cluster deployments
- To enable HMR for local development, set `HMR_ENABLED=true` or `VITE_HMR_ENABLED=true` in your `.env.local`
- Useful for local development when you want hot reloading

### HTTPS Support

For custom host development with HTTPS:
- Set `HOST` environment variable
- Place SSL certificates in `certs/` directory:
  - `certs/local.${HOST}.pem`
  - `certs/local.${HOST}-key.pem`

## Development Patterns

### File Locking

The system includes file locking to prevent concurrent modifications:
- Lock files before making changes
- Release locks after operations complete
- Handle lock conflicts gracefully

### Action Callbacks

When implementing new action types:
1. Define action in `app/types/actions.ts`
2. Add parser logic in `message-parser.ts`
3. Implement execution in `action-runner.ts`
4. Update prompt instructions if needed

### Adding New LLM Providers

1. Create provider file in `app/lib/modules/llm/providers/`
2. Extend `BaseProvider` class
3. Implement required methods: `getModelList()`, `createChatCompletion()`
4. Register in provider registry
5. Add environment variable support in `vite.config.ts`
6. Update `.env.example` with new variables

### Error Handling

The application has sophisticated error detection:
- **Preview errors**: Caught from iframe via `preview-message` events
- **Terminal errors**: Detected and can trigger automatic fix requests
- **Action errors**: Wrapped in `ActionCommandError` with output capture

## WebContainer Best Practices

When working with WebContainer-related code:
- Always use Node.js-based tooling over system commands
- Prefer `npm`/`pnpm`/`yarn` scripts over custom shell scripts
- Use Vite for development servers
- Avoid operations requiring native compilation
- Test Python code with standard library only
- Use `isomorphic-git` instead of git CLI

## Testing Approach

- Limited test coverage focused on critical parsing logic
- Test files use Vitest
- Message parser has comprehensive tests (`message-parser.spec.ts`)
- Manual testing with multiple LLM providers is essential

## Deployment Options

1. **Cloudflare Pages**: Official deployment target (`pnpm run deploy`)
2. **Docker**: Production-grade containers with multi-stage builds
3. **Netlify/Vercel**: Integrated deployment from within the app
4. **Electron**: Desktop application builds for macOS, Windows, Linux

## Known Issues

- Chrome 129 has JavaScript module issues in development (use Chrome Canary)
- WebContainer requires cross-origin isolation headers
- IPv6 issues with localhost URLs (use 127.0.0.1 instead)

## Additional Resources

- [Contributing Guide](./context/CONTRIBUTING.md): Detailed contribution guidelines
- [README](./README.md): Setup instructions and feature list
- [Prompt System](./app/lib/common/prompts/README.md): Enhanced prompt documentation
