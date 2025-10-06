# Logger Usage Guide

## Quick Start

The application uses a custom logger system located in `app/utils/logger.ts` that supports JSON formatting, multiple log levels, and environment-based configuration.

## Setting Log Levels

### Option 1: Environment Variables (Recommended)

Create or edit your `.env` files:

**Development (`.env.development`)**:
```bash
VITE_LOG_LEVEL=debug
```

**Production (`.env.production`)**:
```bash
VITE_LOG_LEVEL=info
```

**Testing (`.env.test`)**:
```bash
VITE_LOG_LEVEL=warn
```

### Option 2: Command Line Override

```bash
# Run with debug logging
VITE_LOG_LEVEL=debug npm run dev

# Run with error-only logging
VITE_LOG_LEVEL=error npm run build

# Disable all logging
VITE_LOG_LEVEL=none npm start
```

### Option 3: Runtime Configuration

```typescript
import { logger } from '~/utils/logger';

// Enable debug logging at runtime
logger.setLevel('debug');

// Disable all logging
logger.setLevel('none');

// Set to info level
logger.setLevel('info');
```

## Available Log Levels

| Level   | When to Use | Production Default |
|---------|-------------|-------------------|
| `trace` | Extreme detail, rarely used | ❌ Disabled |
| `debug` | Development debugging | ❌ Disabled |
| `info`  | Important runtime information | ✅ Enabled |
| `warn`  | Warnings and potential issues | ✅ Enabled |
| `error` | Actual errors and failures | ✅ Enabled |
| `none`  | Disable all logging | - |

## Usage Examples

### Basic Logging

```typescript
import { logger } from '~/utils/logger';

// Simple string messages
logger.info('Application started');
logger.debug('Processing user input');
logger.warn('API rate limit approaching');
logger.error('Failed to save data');

// Multiple arguments
logger.info('User logged in:', userId, 'at', new Date());
```

### Logging Objects and JSON

```typescript
// Simple objects - automatically formatted as JSON
const user = { id: 123, name: 'John Doe', email: 'john@example.com' };
logger.info('User created:', user);

// Output in development (pretty-printed):
// [INFO] User created:
// {
//   "id": 123,
//   "name": "John Doe",
//   "email": "john@example.com"
// }

// Output in production (compact):
// [INFO] User created: {"id":123,"name":"John Doe","email":"john@example.com"}

// Complex nested objects
const state = {
  users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
  settings: {
    theme: 'dark',
    notifications: { email: true, push: false }
  }
};
logger.debug('Application state:', state);
```

### Scoped Loggers (Recommended)

Scoped loggers add context to your logs, making them easier to trace:

```typescript
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('UserService');

logger.info('Fetching user data');
// Output: [INFO] [UserService] Fetching user data

logger.error('Database connection failed:', error);
// Output: [ERROR] [UserService] Database connection failed: Error: ...
```

**More Examples**:

```typescript
// Payment processing
const paymentLogger = createScopedLogger('PaymentService');
paymentLogger.info('Processing payment:', {
  orderId: 'ORD-123',
  amount: 99.99,
  currency: 'USD'
});

// API calls
const apiLogger = createScopedLogger('GitHub API');
apiLogger.debug('Request:', { method: 'POST', endpoint: '/repos' });
apiLogger.info('Response:', { status: 201, created: true });

// Database operations
const dbLogger = createScopedLogger('Database');
dbLogger.warn('Slow query detected:', { duration: '5.2s', query: 'SELECT * FROM ...' });
```

### Logging Errors

```typescript
try {
  await someAsyncOperation();
} catch (error) {
  // Errors are automatically formatted with stack traces
  logger.error('Operation failed:', error);
  
  // Add context
  logger.error('Failed to process payment:', { orderId, userId }, error);
}
```

### Mixed Types

```typescript
// The logger handles mixed argument types automatically
logger.debug(
  'Processing request:',
  requestId,
  'for user:',
  userId,
  'with data:',
  { items: ['a', 'b', 'c'], total: 42 }
);

// Output:
// [DEBUG] Processing request: req-123 for user: 456 with data:
// {
//   "items": ["a", "b", "c"],
//   "total": 42
// }
```

## Real-World Examples

### API Request Logging

```typescript
const logger = createScopedLogger('API');

async function fetchUserData(userId: string) {
  logger.debug('Fetching user data:', { userId });
  
  try {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    
    logger.info('User data retrieved:', {
      userId,
      status: response.status,
      dataSize: JSON.stringify(data).length
    });
    
    return data;
  } catch (error) {
    logger.error('Failed to fetch user data:', { userId }, error);
    throw error;
  }
}
```

### State Management

```typescript
const logger = createScopedLogger('Store');

class UserStore {
  setUser(user: User) {
    logger.debug('Updating user state:', user);
    this.user = user;
    logger.info('User state updated:', { userId: user.id });
  }
  
  clearUser() {
    logger.info('Clearing user state');
    this.user = null;
  }
}
```

### File Operations

```typescript
const logger = createScopedLogger('FileService');

async function saveFile(path: string, content: string) {
  logger.debug('Saving file:', { path, size: content.length });
  
  try {
    await writeFile(path, content);
    logger.info('File saved successfully:', { path });
  } catch (error) {
    logger.error('Failed to save file:', { path }, error);
    throw error;
  }
}
```

## Log Level Guidelines

### 🔴 Use `logger.error()` for:
- Exceptions in try-catch blocks
- Failed operations (database, API, file I/O)
- Critical errors that need immediate attention
- Unrecoverable errors

```typescript
logger.error('Database connection failed:', error);
logger.error('Payment processing failed:', { orderId, userId }, error);
```

### 🟡 Use `logger.warn()` for:
- Deprecated feature usage
- Invalid configurations with fallbacks
- Resource warnings (rate limits, memory)
- Recoverable errors
- Potential issues

```typescript
logger.warn('API rate limit exceeded, retrying in 60s');
logger.warn('Using default configuration:', { reason: 'Invalid config' });
```

### 🔵 Use `logger.info()` for:
- Important business events
- Successful operations
- User actions
- State changes
- API completions

```typescript
logger.info('User registered:', { userId, email });
logger.info('Payment processed:', { orderId, amount });
logger.info('File uploaded:', { filename, size });
```

### ⚪ Use `logger.debug()` for:
- Development debugging
- Detailed operational info
- Internal state tracking
- Function entry/exit
- Variable values

```typescript
logger.debug('Processing step 1:', { data });
logger.debug('Calculated result:', { input, output });
logger.debug('Cache hit:', { key, value });
```

## Best Practices

### ✅ DO

1. **Use scoped loggers** for better traceability:
   ```typescript
   const logger = createScopedLogger('MyComponent');
   ```

2. **Log objects directly** (they're automatically formatted):
   ```typescript
   logger.info('User data:', user);  // ✅ Good
   ```

3. **Include relevant context**:
   ```typescript
   logger.error('Save failed:', { userId, fileId }, error);
   ```

4. **Use appropriate log levels**:
   ```typescript
   logger.debug('Internal calculation:', value);  // Development only
   logger.info('User action completed:', action);  // Production relevant
   logger.error('Critical failure:', error);       // Needs attention
   ```

### ❌ DON'T

1. **Don't use console.log directly**:
   ```typescript
   console.log(user);  // ❌ Bad
   logger.info('User:', user);  // ✅ Good
   ```

2. **Don't stringify objects manually**:
   ```typescript
   logger.info('User:', JSON.stringify(user));  // ❌ Bad
   logger.info('User:', user);  // ✅ Good (automatic)
   ```

3. **Don't log sensitive data**:
   ```typescript
   logger.info('Login:', { password });  // ❌ Bad - security risk
   logger.info('Login:', { username });  // ✅ Good
   ```

4. **Don't overuse error level**:
   ```typescript
   logger.error('API responded with 404');  // ❌ Bad (use warn)
   logger.warn('Resource not found');       // ✅ Good
   ```

## Performance Considerations

1. **Debug logs are automatically disabled in production** for better performance
2. **Objects are stringified lazily** - if a log level is disabled, formatting is skipped
3. **Use debug level liberally** in development - it won't affect production

## Troubleshooting

### Logs not appearing?

Check your log level:
```typescript
// In browser console or Node.js
logger.setLevel('debug');
```

Check environment variable:
```bash
echo $VITE_LOG_LEVEL
```

### JSON formatting not working?

Make sure you're passing objects directly:
```typescript
// ✅ Correct
logger.info('Data:', { key: 'value' });

// ❌ Wrong
logger.info('Data:', 'key=value');
```

### Too much output in production?

Set production log level to `info` or `warn`:
```bash
# .env.production
VITE_LOG_LEVEL=info
```

## Migration from console.log

If you have existing `console.log` statements:

```typescript
// Before
console.log('User data:', user);
console.error('Failed:', error);

// After
logger.info('User data:', user);
logger.error('Failed:', error);
```

For development/debugging:
```typescript
// Before
console.log('Debug info:', data);

// After
logger.debug('Debug info:', data);
```

---

**Need Help?** Check `app/utils/logger.ts` for the full API documentation and examples.

