# Communication Bus Architecture

A clean, simple communication system for iframe-parent messaging using `postMessage` API.

## 🏗️ Architecture Overview

```
┌─────────────────┐    postMessage    ┌─────────────────┐
│   Parent App    │ ◄──────────────► │   bolt.diy      │
│                 │                   │   (iframe)      │
└─────────────────┘                   └─────────────────┘
```

### Core Components

1. **PostMessageService** - Core service handling message sending/receiving
2. **useCommunicationBusChild** - React hook for iframe integration
3. **Types** - Clean TypeScript definitions

## 🚀 Quick Setup

### 1. Integration (Already Done)

The communication bus is automatically initialized in `app/root.tsx`:

```typescript
// Initialize communication bus for iframe child
useCommunicationBusChild({
  logLevel: 'error',
  targetOrigin: '*',
});
```

### 2. Usage in Components

```typescript
import { useCommunicationBusChild } from '~/lib/hooks/useCommunicationBus';

function MyComponent() {
  const bus = useCommunicationBusChild();

  // Send a message (fire and forget)
  const sendNotification = () => {
    bus.sendMessage({
      type: 'USER_ACTION',
      payload: { action: 'save', timestamp: Date.now() }
    });
  };

  // Request data from parent
  const fetchConfig = async () => {
    try {
      const config = await bus.sendMessageWithResponse({
        type: 'GET_CONFIG',
        payload: { section: 'theme' }
      });
      console.log('Got config:', config);
    } catch (error) {
      console.error('Failed to get config:', error);
    }
  };

  // Listen for messages from parent
  useEffect(() => {
    const unsubscribe = bus.on('PARENT_MESSAGE', (payload) => {
      console.log('Received from parent:', payload);
    });

    return unsubscribe;
  }, []);

  return (
    <div>
      <button onClick={sendNotification}>Send Notification</button>
      <button onClick={fetchConfig}>Get Config</button>
    </div>
  );
}
```

## 📡 API Reference

### Hook: `useCommunicationBusChild(config?)`

Returns an object with communication methods:

#### Methods

- **`sendMessage(message)`** - Send message without waiting for response
- **`sendMessageWithResponse(message, options?)`** - Send message and wait for response
  - `options.timeout?` - Custom timeout in milliseconds
  - `options.responseType?` - Expected response message type (defaults to outgoing message type)
- **`on(type, handler)`** - Listen for messages, returns unsubscribe function
- **`off(type, handler?)`** - Stop listening for messages

#### Properties

- **`isReady`** - Boolean indicating if bus is ready
- **`isConnected`** - Boolean indicating if connected to parent
- **`status`** - Object with detailed status information

### Message Types

```typescript
interface BusMessage<T = any> {
  type: string;           // Message type identifier
  payload?: T;           // Message data
  messageId?: string;    // Unique identifier (auto-generated)
  responseId?: string;   // ID of message being responded to
  timestamp?: number;    // Unix timestamp (auto-generated)
  source?: string;       // Source identifier (auto-set)
}
```

### Built-in Message Types

```typescript
enum MessageType {
  READY = 'READY',         // System ready signal
  HEARTBEAT = 'HEARTBEAT', // Connection health check
  ERROR = 'ERROR',         // Error notifications
}
```

## 🎯 Usage Patterns

### 1. Fire and Forget (Notifications)

```typescript
// Send status updates, notifications, events
bus.sendMessage({
  type: 'FILE_SAVED',
  payload: { filename: 'project.json', size: 1024 }
});

bus.sendMessage({
  type: 'USER_ACTIVITY',
  payload: { page: '/editor', action: 'edit' }
});
```

### 2. Request/Response (Data Fetching)

```typescript
// Get configuration
const themeConfig = await bus.sendMessageWithResponse({
  type: 'GET_THEME_CONFIG',
  payload: {}
});

// Save data and get confirmation
const result = await bus.sendMessageWithResponse({
  type: 'SAVE_PROJECT',
  payload: { project: projectData }
});

// With custom timeout (default: 30 seconds)
const quickResult = await bus.sendMessageWithResponse({
  type: 'QUICK_CHECK',
  payload: {}
}, { timeout: 5000 }); // 5 second timeout

// With specific response type validation
const dataResult = await bus.sendMessageWithResponse({
  type: 'GET_DATA',
  payload: { dataType: 'user' }
}, { 
  timeout: 10000,
  responseType: 'DATA_RESPONSE' // Will validate that response has this type
});
```

### 3. Listening for Parent Messages

```typescript
useEffect(() => {
  // Listen for theme changes
  const unsubTheme = bus.on('THEME_CHANGED', (newTheme) => {
    setTheme(newTheme);
  });

  // Listen for data updates
  const unsubData = bus.on('DATA_UPDATE', (data) => {
    updateLocalData(data);
  });

  // Cleanup
  return () => {
    unsubTheme();
    unsubData();
  };
}, []);
```

## 🔧 Configuration Options

```typescript
interface CommunicationBusConfig {
  debug?: boolean;           // Enable debug mode (default: false)
  logLevel?: 'error' | 'warn' | 'info'; // Log level (default: 'error')
  timeout?: number;          // Response timeout in ms (default: 30000)
  targetOrigin?: string;     // Target origin for postMessage (default: '*')
  messageQueueSize?: number; // Max queued messages (default: 100)
}
```

## 🛡️ Security & Best Practices

### Security
- Messages are filtered to prevent processing of unrelated postMessage events
- Built-in validation for message structure
- Origin checking (configurable via `targetOrigin`)

## 🆕 New Features

### Response Type Validation

The enhanced `sendMessageWithResponse` method now supports configuring the expected incoming response type:

```typescript
// Send GET_DATA but expect DATA_RESPONSE type back
const response = await bus.sendMessageWithResponse(
  {
    type: 'GET_DATA',
    payload: { query: 'users' }
  },
  {
    responseType: 'DATA_RESPONSE', // Validate incoming response type
    timeout: 5000
  }
);
```

**Benefits:**
- **Type Safety**: Ensures responses match expected message types
- **Debugging**: Warns about mismatched response types in console
- **Backward Compatible**: If not specified, defaults to outgoing message type
- **Flexible Configuration**: Combine with custom timeouts

**When to Use:**
- When your request/response flow uses different message types
- For APIs that return standardized response types
- When debugging communication flows

### Best Practices
1. **Use specific message types** - Make them descriptive and unique
2. **Handle errors** - Always wrap `sendMessageWithResponse` in try-catch
3. **Clean up listeners** - Return unsubscribe functions from useEffect
4. **Validate payloads** - Check received data structure in your handlers
5. **Response Types** - Use `responseType` option when request/response types differ

### Performance
- Messages are queued until connection is ready
- Automatic cleanup on component unmount
- Minimal overhead with efficient message filtering

## 🔍 Debugging

Check connection status:

```typescript
const bus = useCommunicationBusChild();

console.log('Bus Status:', {
  ready: bus.isReady,
  connected: bus.isConnected,
  stats: bus.status
});
```

Enable debug logging:

```typescript
useCommunicationBusChild({
  debug: true,
  logLevel: 'info'
});
```

## 📝 Example: Complete Component

```typescript
import React, { useState, useEffect } from 'react';
import { useCommunicationBusChild } from '~/lib/hooks/useCommunicationBus';

export function EditorComponent() {
  const bus = useCommunicationBusChild();
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState('idle');

  // Load initial config from parent
  useEffect(() => {
    if (bus.isReady) {
      loadConfig();
    }
  }, [bus.isReady]);

  // Listen for parent messages
  useEffect(() => {
    const unsubscribers = [
      bus.on('CONFIG_UPDATED', (newConfig) => {
        setConfig(newConfig);
      }),
      
      bus.on('SAVE_REQUEST', async () => {
        await saveProject();
      })
    ];

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  const loadConfig = async () => {
    try {
      const result = await bus.sendMessageWithResponse({
        type: 'GET_EDITOR_CONFIG',
        payload: {}
      });
      setConfig(result);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const saveProject = async () => {
    setStatus('saving');
    try {
      await bus.sendMessageWithResponse({
        type: 'SAVE_PROJECT',
        payload: { data: 'project data here' }
      });
      setStatus('saved');
      
      // Notify parent of successful save
      bus.sendMessage({
        type: 'PROJECT_SAVED',
        payload: { timestamp: Date.now() }
      });
    } catch (error) {
      setStatus('error');
      console.error('Save failed:', error);
    }
  };

  return (
    <div>
      <h2>Editor</h2>
      <p>Status: {status}</p>
      <p>Connected: {bus.isConnected ? '✅' : '❌'}</p>
      <button onClick={saveProject} disabled={!bus.isReady}>
        Save Project
      </button>
    </div>
  );
}
```

---

## 🎉 That's It!

The communication bus is designed to be simple, reliable, and easy to use. The bolt.diy iframe can now communicate seamlessly with its parent application using a clean, type-safe API.