# Dynamic Deployment Configuration Guide

This project now supports dynamic host and base path configuration, allowing you to deploy the application at any path and with any host configuration without hardcoded values.

## 🚀 Quick Start

### Environment Variables

The application supports the following configuration variables:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `BASE_PATH` | Base path for the application | `""` (root) | `/ai-editor`, `/my-app` |
| `HOST` | Host for development server | auto-detected | `example.com`, `localhost` |
| `PORT` | Port for the server | `5173` | `8080`, `3000` |

### Vite Environment Variables (Build Time)

For build-time configuration, use the `VITE_` prefixed versions:

| Variable | Description | Build Usage |
|----------|-------------|-------------|
| `VITE_BASE_PATH` | Base path available in browser | Overrides `BASE_PATH` |
| `VITE_HOST` | Host available in browser | Overrides `HOST` |
| `VITE_PORT` | Port available in browser | Overrides `PORT` |

## 📋 Deployment Scenarios

### 1. Root Deployment (Default)

Deploy at the root of your domain:

```bash
# No configuration needed
npm run build
npm run start
```

Access at: `https://yourdomain.com/`

### 2. Sub-path Deployment

Deploy at a specific path:

```bash
# Set base path
export BASE_PATH="/ai-editor"
npm run build
npm run start
```

Access at: `https://yourdomain.com/ai-editor/`

### 3. Custom Host and Port

```bash
export HOST="myapp.internal"
export PORT="8080"
export BASE_PATH="/tools"
npm run build
npm run start
```

Access at: `https://myapp.internal:8080/tools/`

## 🐳 Docker Configuration

### Build with Configuration

```bash
# Build with custom configuration
docker build \
  --build-arg BASE_PATH="/ai-editor" \
  --build-arg HOST="myapp.com" \
  --build-arg PORT=8080 \
  -t bolt-ai:custom .
```

### Run with Environment Variables

```bash
# Run with runtime configuration
docker run \
  -e BASE_PATH="/my-app" \
  -e HOST="localhost" \
  -e PORT=3000 \
  -p 3000:3000 \
  bolt-ai:custom
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  bolt-ai:
    build:
      context: .
      args:
        BASE_PATH: "/ai-editor"
        HOST: "bolt.local"
        PORT: 8080
    environment:
      - BASE_PATH=/ai-editor
      - HOST=bolt.local
      - PORT=8080
    ports:
      - "8080:8080"
```

## ☁️ Cloudflare Pages Deployment

### Environment Variables in Pages Dashboard

1. Go to your Cloudflare Pages project
2. Navigate to Settings > Environment Variables
3. Add variables for your deployment:

```
BASE_PATH = /ai-editor
```

### Using Wrangler

Update your `wrangler.toml`:

```toml
[vars]
BASE_PATH = "/your-base-path"

[[pages.rules]]
pattern = "/your-base-path/*"
priority = 100
```

## 🔧 Development Configuration

### Local Development

Create a `.env.local` file:

```bash
# Development configuration
BASE_PATH=/ai-editor
HOST=localhost
PORT=5173
VITE_LOG_LEVEL=debug
```

### Development with Custom Domain

For HTTPS development with custom domains:

```bash
# Set up certificates (see HTTPS_DEVELOPMENT_SETUP.md)
export HOST="local.myapp.com"
export BASE_PATH="/dev"
npm run dev
```

## 📝 Configuration Priority

The configuration system follows this priority order:

1. **Runtime Environment Variables** (`BASE_PATH`, `HOST`, `PORT`)
2. **Vite Build Variables** (`VITE_BASE_PATH`, `VITE_HOST`, `VITE_PORT`)
3. **Auto-detection** (browser URL analysis)
4. **Defaults** (root path, auto-detected host, port 5173)

## 🛠️ Advanced Configuration

### Programmatic Configuration

You can also configure the app programmatically:

```typescript
import { getAppConfig, resetConfigCache } from '~/lib/config';

// Get current configuration
const config = getAppConfig();
console.log('Current config:', config);

// Force reconfiguration (useful for testing)
resetConfigCache();
```

### Debug Configuration

To see the current configuration in the browser console:

```typescript
import { getConfigSummary } from '~/lib/config';
console.log('App Configuration:', getConfigSummary());
```

## 🧪 Testing Different Configurations

### Test Root Deployment

```bash
unset BASE_PATH
npm run build
npm run start
```

### Test Sub-path Deployment

```bash
export BASE_PATH="/test-path"
npm run build
npm run start
```

### Test Custom Port

```bash
export PORT=8080
npm run build
npm run start
```

## 🚨 Troubleshooting

### Assets Not Loading

If assets aren't loading correctly:

1. Check your `BASE_PATH` configuration
2. Verify middleware is handling routes correctly
3. Check browser network tab for 404s
4. Ensure build was done with correct environment variables

### API Calls Failing

If API calls are failing:

1. Verify the fetch interceptor is working
2. Check that `BASE_PATH` is consistent between build and runtime
3. Look for CORS issues in browser console

### Docker Container Issues

If Docker container isn't starting:

1. Check that `PORT` environment variable matches exposed port
2. Verify environment variables are being passed correctly
3. Check container logs for configuration issues

## 📚 Related Documentation

- [Base Path Deployment Guide](./BASE_PATH_DEPLOYMENT_GUIDE.md) - Original implementation
- [HTTPS Development Setup](./HTTPS_DEVELOPMENT_SETUP.md) - SSL certificates
- [API Interceptor Guide](./API_INTERCEPTOR_GUIDE.md) - How API routing works

## 🔄 Migration from Fixed Configuration

If you're migrating from the previous fixed `/ai-editor` setup:

1. **Remove hardcoded paths** - The system now auto-detects
2. **Update deployment scripts** - Use environment variables instead of hardcoded values
3. **Update Cloudflare Pages settings** - Remove hardcoded routes or update patterns
4. **Test thoroughly** - Verify all deployment scenarios work correctly

This new system is backward compatible - if you don't set any configuration, it will work at the root path by default.