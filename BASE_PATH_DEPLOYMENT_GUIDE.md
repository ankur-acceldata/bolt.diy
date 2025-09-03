# Base Path Deployment Guide

This guide explains how the application handles base path deployment (e.g., `/ai-editor/`) with Wrangler and ensures all static assets are served correctly with HTTPS protocol preservation.

## Overview

The application is configured to work with a base path of `/ai-editor/` when deployed using Wrangler. This configuration ensures:

1. All static assets (CSS, JS, images, fonts) are served through the base path
2. HTTPS protocol is preserved and preferred
3. Proper redirects are handled for assets accessed without base path
4. Cross-origin headers are correctly set for security

## Key Components

### 1. Middleware (`functions/_middleware.ts`)

The middleware handles:
- **Base path routing**: Ensures all requests are properly routed through `/ai-editor/`
- **Static asset redirects**: Redirects requests from `/assets/...` to `/ai-editor/assets/...`
- **Protocol preservation**: Maintains HTTPS protocol in redirects
- **Cross-origin headers**: Adds necessary security headers
- **Asset type detection**: Handles various file types (CSS, JS, fonts, images)

### 2. Vite Configuration (`vite.config.ts`)

Key configurations:
- `base: '/ai-editor/'` - Sets the base path for all assets
- `import.meta.env.BASE_URL` definition - Makes base path available to client code
- Build output directory configuration

### 3. API Utilities (`app/utils/api.ts`)

Provides functions for:
- `getBasePath()` - Detects and returns the correct base path
- `getProtocol()` - Prefers HTTPS when available
- `apiUrl()` - Constructs API URLs with base path
- `assetUrl()` - Generates asset URLs with base path
- `absoluteAssetUrl()` - Creates absolute asset URLs

### 4. Wrangler Configuration (`wrangler.toml`)

Settings:
- `BASE_PATH = "/ai-editor"` environment variable
- Route rules for proper asset serving
- Compatibility flags for Node.js support

## Deployment Process

### 1. Build the Application

```bash
npm run build
```

This creates the production build with proper base path configuration.

### 2. Deploy with Wrangler

```bash
npm run deploy
```

Or manually:

```bash
wrangler pages deploy ./build/client
```

### 3. Verify Deployment

Check that:
- ✅ Main application loads at `https://your-domain.com/ai-editor/`
- ✅ All CSS files load correctly (no 404s)
- ✅ JavaScript bundles load correctly
- ✅ Images and fonts display properly
- ✅ API calls work correctly
- ✅ HTTPS is enforced

## How Asset Serving Works

### Static Asset Flow

1. **Request comes in**: `GET /assets/styles.css`
2. **Middleware intercepts**: Recognizes as static asset without base path
3. **Redirect issued**: `301 redirect` to `/ai-editor/assets/styles.css`
4. **Asset served**: Cloudflare Pages serves the file from the correct path

### Protocol Preservation

1. **HTTPS detection**: Middleware checks `x-forwarded-proto` header and request protocol
2. **Redirect creation**: Always uses HTTPS when available or in production
3. **Client-side preference**: `getProtocol()` prefers HTTPS for non-localhost domains

## Troubleshooting

### 1. Assets Not Loading (404 errors)

**Symptoms**: CSS/JS files return 404, application appears unstyled

**Solutions**:
- Verify `BASE_PATH=/ai-editor` is set in environment
- Check middleware is handling redirects correctly
- Ensure build output directory matches wrangler.toml configuration

### 2. Mixed Content Warnings

**Symptoms**: HTTPS site trying to load HTTP assets

**Solutions**:
- Check `getProtocol()` function is returning HTTPS
- Verify middleware `createRedirect()` preserves HTTPS
- Ensure no hardcoded HTTP URLs in code

### 3. API Calls Failing

**Symptoms**: 404 errors on API routes

**Solutions**:
- Use `apiUrl()` function for all API calls
- Verify API routes include base path: `/ai-editor/api/...`
- Check middleware routes API calls correctly

### 4. Font/Image Loading Issues

**Symptoms**: Missing fonts or broken images

**Solutions**:
- Use `assetUrl()` for all asset references
- Verify static asset paths in middleware configuration
- Check asset files are included in build output

## Environment Variables

| Variable | Description | Default | Usage |
|----------|-------------|---------|-------|
| `BASE_PATH` | Base path for application | `/ai-editor` | Set in wrangler.toml |
| `VITE_BASE_URL` | Vite base URL | `/ai-editor/` | Used during build |

## Testing Base Path Deployment

### Local Testing

1. Build the application:
   ```bash
   npm run build
   ```

2. Start with base path:
   ```bash
   BASE_PATH=/ai-editor npm run start
   ```

3. Test at `http://localhost:5173/ai-editor/`

### Production Testing

1. Deploy to Cloudflare Pages
2. Access via `https://your-domain.com/ai-editor/`
3. Check browser network tab for any 404s
4. Verify all assets load over HTTPS

## Security Considerations

- **Cross-Origin Headers**: Properly configured for WebContainer isolation
- **HTTPS Enforcement**: Automatic redirect to HTTPS in production
- **Asset Caching**: Static assets have proper cache headers
- **Content Security**: CORS headers configured for API access

## Performance Optimizations

- **Asset Caching**: 1-year cache for immutable assets
- **Compression**: Handled by Cloudflare Pages
- **HTTP/2**: Automatic with HTTPS
- **CDN**: Global distribution via Cloudflare

This configuration ensures the application works correctly when deployed with a base path while maintaining security, performance, and proper asset serving.
