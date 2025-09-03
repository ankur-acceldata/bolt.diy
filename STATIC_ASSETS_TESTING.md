# Static Assets and Base Path Testing Guide

This guide helps you test and verify that static assets are being served correctly from the base path in both development and production.

## 🧪 Development Testing

### Test 1: Basic Base Path Development

```bash
# Start development server with base path
BASE_PATH=/ai-editor pnpm dev

# Or with custom host for HTTPS testing
BASE_PATH=/ai-editor HOST=local.demo.xdp.acceldata.tech pnpm dev
```

**Expected behavior:**
- Server starts at configured host and port
- Console shows base path middleware logs: `[BasePathDev] Request: ...`
- Application accessible at: `https://local.demo.xdp.acceldata.tech:5173/ai-editor/`

### Test 2: Static Asset Redirection

When the dev server is running, test these URLs in your browser:

**Direct asset access (should redirect):**
```
❌ https://local.demo.xdp.acceldata.tech:5173/assets/styles.css
   → Should redirect to ✅ /ai-editor/assets/styles.css

❌ https://local.demo.xdp.acceldata.tech:5173/build/client.js  
   → Should redirect to ✅ /ai-editor/build/client.js
```

**Correct asset access (should work):**
```
✅ https://local.demo.xdp.acceldata.tech:5173/ai-editor/assets/
✅ https://local.demo.xdp.acceldata.tech:5173/ai-editor/build/
```

### Test 3: Application Routes

```
✅ https://local.demo.xdp.acceldata.tech:5173/ai-editor/
✅ https://local.demo.xdp.acceldata.tech:5173/ai-editor/chat/new
✅ https://local.demo.xdp.acceldata.tech:5173/ai-editor/api/models
```

## 🔍 Debug Console Logs

Check browser console and terminal for:

### Terminal Logs (Development Server)
```bash
[BasePathDev] Request: /assets/main.css
[BasePathDev] Redirecting /assets/main.css -> /ai-editor/assets/main.css

[BasePathDev] Request: /ai-editor/assets/main.css
# No redirect - serving directly

[BasePathDev] Request: /ai-editor/
# Application route - passing to Remix
```

### Browser Network Tab
- ✅ CSS files: `200 OK` from `/ai-editor/assets/...`
- ✅ JS files: `200 OK` from `/ai-editor/build/...`
- ✅ API calls: `200 OK` to `/ai-editor/api/...`
- ❌ No `404` errors for static assets

## 🚨 Troubleshooting

### Issue: CSS/JS Files Not Loading (404 errors)

**Symptoms:**
- Application appears unstyled
- Network tab shows 404 for asset files
- Assets being requested from wrong path

**Debug Steps:**
1. Check browser network tab for actual request URLs
2. Verify development server console for redirect logs
3. Check if `BASE_PATH` environment variable is set correctly

**Solutions:**
```bash
# Verify environment variable
echo $BASE_PATH

# Restart development server
BASE_PATH=/ai-editor pnpm dev

# Check Vite configuration
# Should see "base: '/ai-editor/'" in build output
```

### Issue: Middleware Not Working

**Symptoms:**
- No `[BasePathDev]` logs in terminal
- Static assets not redirecting
- Direct asset URLs return 404

**Debug Steps:**
1. Check if `basePathDevPlugin` is being loaded
2. Verify `BASE_PATH` is not empty
3. Check middleware order in `vite.config.ts`

**Solutions:**
```typescript
// In vite.config.ts, ensure plugin is added:
plugins: [
  // ... other plugins
  chrome129IssuePlugin(),
  basePathDevPlugin(BASE_PATH), // ← Should be here
],
```

### Issue: API Calls Failing

**Symptoms:**
- API endpoints return 404
- Network tab shows wrong API URLs

**Debug Steps:**
1. Check if API calls include base path
2. Verify fetch interceptor is working
3. Check proxy configuration

**Solutions:**
```typescript
// API calls should automatically include base path
// Check if fetch interceptor is installed

// Manual API URL construction:
import { getApiUrl } from '~/lib/config';
const url = getApiUrl('/models'); // Returns: /ai-editor/api/models
```

## 🎯 Quick Verification Checklist

When testing `BASE_PATH=/ai-editor pnpm dev`:

- [ ] Server starts without errors
- [ ] Can access: `https://host:port/ai-editor/`
- [ ] Browser console shows no 404s for assets
- [ ] CSS styles are applied correctly
- [ ] JavaScript functionality works
- [ ] API calls work (check network tab)
- [ ] Direct asset URLs redirect properly
- [ ] Terminal shows `[BasePathDev]` logs

## 🔧 Production Testing

### Test with Built Assets

```bash
# Build with base path
BASE_PATH=/ai-editor pnpm build

# Start production server
BASE_PATH=/ai-editor pnpm start

# Or using Docker
docker build --build-arg BASE_PATH=/ai-editor -t test-app .
docker run -e BASE_PATH=/ai-editor -p 5173:5173 test-app
```

### Cloudflare Pages Testing

Update `wrangler.toml`:
```toml
[vars]
BASE_PATH = "/ai-editor"

[[pages.rules]]
pattern = "/ai-editor/*"
priority = 100
```

Deploy and test:
```bash
pnpm deploy
# Test at: https://your-domain.pages.dev/ai-editor/
```

## 🧩 Configuration Validation

### Environment Variables Check

```bash
# Development
BASE_PATH=/ai-editor pnpm dev

# Should see in console:
# "Using BASE_PATH: /ai-editor"
# "Base URL: /ai-editor/"
```

### Browser Configuration Check

In browser console:
```javascript
// Check current configuration
import { getConfigSummary } from '/ai-editor/build/assets/config-xyz.js';
console.log('App Config:', getConfigSummary());

// Expected output:
// {
//   basePath: "/ai-editor",
//   baseUrl: "/ai-editor/",
//   host: "local.demo.xdp.acceldata.tech",
//   fullBaseUrl: "https://local.demo.xdp.acceldata.tech:5173/ai-editor/"
// }
```

## 📊 Performance Verification

### Asset Loading Performance

1. **First Load**: Check waterfall in network tab
   - No double-loading of assets
   - Proper caching headers
   - No redirect chains

2. **Navigation**: Internal page changes
   - SPA routing works with base path
   - No asset reloads on navigation

3. **HMR**: Hot module replacement in development
   - Updates work with base path
   - WebSocket connections use correct path

## ✅ Success Indicators

Your configuration is working correctly when:

1. **Development**: `BASE_PATH=/ai-editor pnpm dev`
   - ✅ Application loads at `/ai-editor/`
   - ✅ All assets serve from `/ai-editor/assets/`
   - ✅ API calls go to `/ai-editor/api/`
   - ✅ Redirects work for direct asset access

2. **Production**: `BASE_PATH=/ai-editor pnpm build && pnpm start`
   - ✅ Built assets include base path
   - ✅ Middleware handles routes correctly
   - ✅ Static files cached properly

3. **Docker**: Build and run with base path
   - ✅ Environment variables pass through
   - ✅ Configuration detected at runtime
   - ✅ All functionality works as expected

This comprehensive testing ensures your dynamic base path configuration works correctly across all deployment scenarios!