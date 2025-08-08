# 🔧 Logger Usage Guide

## Overview

The Bolt.diy project uses an enhanced logging system that provides structured, environment-aware logging with cross-frame support. This guide covers everything you need to know about using the logger effectively.

## Features

- ✅ **Environment-Aware**: Different log levels for development vs production
- ✅ **Cross-Frame Support**: Works across iframes and WebContainer frames
- ✅ **Rich Data Types**: Logs objects, arrays, functions, and primitives naturally
- ✅ **Runtime Controls**: Enable/disable logging from browser console
- ✅ **Persistent Settings**: Log level persists across page reloads
- ✅ **Clean UI**: Disabled by default in browser console for clean experience

## Quick Start

### Using in Code

```typescript
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MyComponent');

// Simple messages
logger.info('Operation completed');
logger.debug('Debug information');
logger.warn('Warning message');
logger.error('Error occurred');

// Rich data types (no JSON.stringify needed!)
logger.debug('User data:', { 
  id: 123, 
  name: 'John',
  preferences: { theme: 'dark' }
});

logger.error('Save failed:', error, { 
  userId: 456, 
  context: 'user-profile',
  timestamp: new Date()
});
```

### Browser Console Controls

```javascript
// Show help
logger.help()

// Enable debug logging across all frames
logger.enableDebugLogging('debug')

// Set specific log level
logger.setLogLevel('info')

// Disable logging (errors only)
logger.disableDebugLogging()

// Check current level
logger.getCurrentLogLevel()
```

## Default Behavior

| Environment | Context | Default Level | Description |
|-------------|---------|---------------|-------------|
| Development | Server | `debug` | Full logging for development |
| Development | Browser/UI | `error` | Clean console by default |
| Production | Server | `warn` | Warnings and errors |
| Production | Browser/UI | `error` | Errors only |

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `trace` | Very detailed debugging | Function entry/exit |
| `debug` | Development debugging | Variable values, flow |
| `info` | Important operations | User actions, state changes |
| `warn` | Warning conditions | Deprecated usage, fallbacks |
| `error` | Error conditions | Exceptions, failures |

## Environment Variables

### `VITE_LOG_LEVEL`
Override default log level for any environment:
```bash
# Enable debug logs in production
VITE_LOG_LEVEL=debug npm run build

# Enable debug logs in UI during development
VITE_LOG_LEVEL=debug npm run dev

# Show only warnings and errors in development
VITE_LOG_LEVEL=warn npm run dev
```

### `VITE_DISABLE_LOGGING`
Disable all logging except errors:
```bash
# Completely quiet development (errors only)
VITE_DISABLE_LOGGING=true npm run dev

# Disable logging in production
VITE_DISABLE_LOGGING=true npm run build
```

## Browser Console Usage

### Accessing Controls

The logger controls are automatically available in the browser console:

```javascript
// Direct functions (global)
enableDebugLogging('debug')
disableDebugLogging()
setLogLevel('info')
getCurrentLogLevel()

// Via logger object (recommended)
logger.enableDebugLogging('debug')
logger.disableDebugLogging()
logger.setLogLevel('info')
logger.getCurrentLogLevel()
logger.help()
```

### Cross-Frame Support

Logger controls work across **ALL frames** including:
- Main application window
- WebContainer iframes
- Preview iframes
- Any embedded frames

```javascript
// Set debug level in main window
logger.enableDebugLogging('debug')
// → ALL frames (including WebContainer) now show debug logs

// Change level from any iframe
setLogLevel('warn')
// → ALL frames switch to warn level
```

### Persistent Settings

Log level persists across:
- Page reloads
- New iframe creation
- Browser sessions (via localStorage)

```javascript
// 1. Set debug level
logger.enableDebugLogging('debug')

// 2. Refresh page → still debug level!
// 3. Open WebContainer → inherits debug level automatically!
```

## Development Workflow

### 1. Normal Development (Clean Console)
```javascript
// Console is clean by default (errors only)
// Server logs show full debug information
```

### 2. UI Debugging
```javascript
// Enable when needed
logger.enableDebugLogging('debug')

// Debug your issue
// ... see all logs in console ...

// Clean up when done
logger.disableDebugLogging()
```

### 3. WebContainer Debugging
```javascript
// Enable debug logs
logger.enableDebugLogging('debug')

// Now WebContainer operations are visible
// File operations, command execution, etc.
```

### 4. Production Debugging
```bash
# Enable debug logs in production build
VITE_LOG_LEVEL=debug npm run build

# Or enable at runtime in browser
logger.enableDebugLogging('debug')
```

## Best Practices

### 1. Use Appropriate Log Levels
```typescript
// ✅ Good
logger.debug('Starting file processing');
logger.info('User saved profile');
logger.warn('Using deprecated API');
logger.error('Failed to save file:', error);

// ❌ Avoid
logger.info('Variable x =', x); // Use debug
logger.error('User clicked button'); // Use info
```

### 2. Rich Context with Objects
```typescript
// ✅ Good - rich context
logger.error('Payment failed:', error, {
  userId,
  amount,
  paymentMethod,
  timestamp: new Date()
});

// ❌ Avoid - stringifying
logger.error('Payment failed:', JSON.stringify(error));
```

### 3. Scoped Loggers
```typescript
// ✅ Good - specific scope
const logger = createScopedLogger('PaymentProcessor');
const dbLogger = createScopedLogger('DatabaseConnection');

// ❌ Avoid - generic scope
const logger = createScopedLogger('App');
```

### 4. Server vs Client Considerations
```typescript
// Server-side: Can be more verbose (not user-facing)
logger.debug('Processing request:', { method, path, headers });

// Client-side: Be mindful of console noise
logger.debug('User interaction:', { action, target }); // OK
logger.debug('Render cycle', props); // Maybe too verbose
```

## Common Scenarios

### Debugging File Operations
```javascript
// Enable debug logs
logger.enableDebugLogging('debug')

// Now you'll see:
// - File creation/deletion
// - WebContainer operations
// - Snapshot creation
// - Git operations
```

### Debugging Chat/AI Interactions
```javascript
// Enable info level to see important operations
logger.setLogLevel('info')

// You'll see:
// - Message processing
// - AI responses
// - State changes
// - Error conditions
```

### Production Troubleshooting
```bash
# Option 1: Environment variable
VITE_LOG_LEVEL=debug npm run build

# Option 2: Runtime (in deployed app)
logger.enableDebugLogging('debug')
```

### WebContainer Debugging
```javascript
// Debug WebContainer operations
logger.enableDebugLogging('debug')

// Now visible:
// - Command execution
// - File system operations
// - Terminal interactions
// - Preview generation
```

## Troubleshooting

### "Logger functions not found"
The logger is automatically loaded. If functions aren't available:
1. Refresh the page
2. Check browser console for loading errors
3. Try `window.logger.help()` instead

### "Changes don't apply to all frames"
Cross-frame communication should work automatically. If not:
1. Check for console errors
2. Verify localStorage is enabled
3. Try refreshing all frames

### "Too much log output"
```javascript
// Reduce verbosity
logger.setLogLevel('warn')  // Only warnings and errors
logger.disableDebugLogging()  // Only errors
```

### "Logs don't persist"
Persistence requires localStorage. If not working:
1. Check browser localStorage permissions
2. Verify not in incognito mode
3. Check for storage quota issues

## Advanced Usage

### Custom Log Filtering
```javascript
// Show only specific scopes in browser DevTools
// Filter by: "WorkbenchStore" to see only workbench logs
// Filter by: "ERROR" to see only errors
```

### Environment-Specific Logging
```typescript
// Different behavior per environment
if (import.meta.env.DEV) {
  logger.debug('Development-only debug info');
}

if (import.meta.env.PROD) {
  logger.info('Production deployment info');
}
```

### Conditional Logging
```typescript
// Only log in certain conditions
if (process.env.ENABLE_VERBOSE_LOGGING) {
  logger.debug('Verbose debugging enabled');
}
```

## Migration from console.log

### Before
```typescript
console.log('User action:', action);
console.error('Error:', error);
console.warn('Deprecated:', api);
```

### After
```typescript
import { createScopedLogger } from '~/utils/logger';
const logger = createScopedLogger('ComponentName');

logger.info('User action:', action);
logger.error('Error:', error);
logger.warn('Deprecated:', api);
```

## Summary

The enhanced logger provides:
- 🧹 **Clean console by default** for better development experience
- 🔧 **Easy runtime controls** for debugging when needed
- 🌐 **Cross-frame support** for complex applications
- 📊 **Rich data logging** without manual stringification
- ⚙️ **Environment awareness** for production-ready logging
- 💾 **Persistent settings** for consistent experience

Use `logger.help()` in the browser console for quick reference!
