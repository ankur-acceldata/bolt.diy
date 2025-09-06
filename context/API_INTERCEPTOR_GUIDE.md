# API Fetch Interceptor Implementation

## Overview

We have implemented a fetch interceptor that automatically adds the base path to all API calls. This eliminates the need for developers to use a special `apiFetch` function or remember to manually add base paths.

## How It Works

### 1. Fetch Interceptor (`app/lib/fetch-interceptor.ts`)

The interceptor:
- Automatically intercepts all `fetch()` calls
- Checks if the URL is a relative API path (starts with `/api/`)
- Prepends the base path from environment variables
- Leaves all other URLs unchanged (absolute URLs, assets, etc.)

### 2. Base Path Configuration

Base path is determined from environment variables only:
1. `import.meta.env.BASE_URL` (Vite environment, available in browser)
2. `process.env.BASE_PATH` (Node.js contexts)
3. Falls back to `/` (root)

### 3. Installation

The interceptor is automatically installed in:
- `app/entry.client.tsx` - for client-side requests
- `app/entry.server.tsx` - for server-side requests

## Usage

### Before (Old Way)
```typescript
import { apiFetch } from '~/utils/api';

// Developers had to remember to use apiFetch
const response = await apiFetch('/api/models');
```

### After (New Way)
```typescript
// Just use regular fetch - interceptor handles base path automatically
const response = await fetch('/api/models');
```

## Benefits

1. **Developer Experience**: No need to remember special functions
2. **Consistency**: All API calls automatically respect base path
3. **Maintainability**: Single point of configuration
4. **Transparency**: Works with any fetch-based library or code

## What URLs Are Intercepted

✅ **Intercepted (base path added):**
- `/api/models`
- `/api/chat`
- `/api/system/diagnostics`

❌ **Not Intercepted (left unchanged):**
- `https://example.com/api` (absolute URLs)
- `/assets/image.png` (non-API paths)
- `./relative-file.js` (relative non-API paths)

## Environment Configuration

The base path is configured via environment variables:

```bash
# Development
BASE_PATH=/ai-editor

# Production (Cloudflare Pages)
BASE_PATH=/ai-editor
```

## Migration Complete

All instances of `apiFetch` have been replaced with regular `fetch` calls:
- ✅ 21+ files updated
- ✅ All imports removed
- ✅ `apiFetch` function removed from `api.ts`
- ✅ Interceptor installed in entry points