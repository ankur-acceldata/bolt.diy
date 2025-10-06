# Logger Examples - Visual Guide

## Before vs After Comparison

### Example 1: Simple Object Logging

**❌ Before (manual stringify)**:
```typescript
const user = { id: 123, name: 'John Doe', email: 'john@example.com' };
console.log('User data:', JSON.stringify(user));
```

**Output**:
```
User data: {"id":123,"name":"John Doe","email":"john@example.com"}
```

**✅ After (automatic JSON)**:
```typescript
const user = { id: 123, name: 'John Doe', email: 'john@example.com' };
logger.info('User data:', user);
```

**Output (Development)**:
```
[INFO] User data:
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Output (Production)**:
```
[INFO] User data: {"id":123,"name":"John Doe","email":"john@example.com"}
```

---

### Example 2: Complex Nested Objects

**✅ Code**:
```typescript
const logger = createScopedLogger('OrderService');

const order = {
  orderId: 'ORD-2024-001',
  customer: {
    id: 456,
    name: 'Alice Smith',
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102'
    }
  },
  items: [
    { sku: 'PROD-001', name: 'Widget', quantity: 2, price: 29.99 },
    { sku: 'PROD-002', name: 'Gadget', quantity: 1, price: 49.99 }
  ],
  total: 109.97,
  status: 'processing'
};

logger.info('Order received:', order);
```

**Output (Development - Pretty Printed)**:
```
[INFO] [OrderService] Order received:
{
  "orderId": "ORD-2024-001",
  "customer": {
    "id": 456,
    "name": "Alice Smith",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102"
    }
  },
  "items": [
    {
      "sku": "PROD-001",
      "name": "Widget",
      "quantity": 2,
      "price": 29.99
    },
    {
      "sku": "PROD-002",
      "name": "Gadget",
      "quantity": 1,
      "price": 49.99
    }
  ],
  "total": 109.97,
  "status": "processing"
}
```

---

### Example 3: API Request/Response Logging

**✅ Code**:
```typescript
const logger = createScopedLogger('GitHub API');

// Request
const request = {
  method: 'POST',
  endpoint: '/repos/owner/repo/issues',
  headers: { 'Content-Type': 'application/json' },
  body: { title: 'Bug Report', labels: ['bug', 'urgent'] }
};

logger.debug('API Request:', request);

// Response
const response = {
  status: 201,
  statusText: 'Created',
  data: {
    id: 789,
    number: 42,
    title: 'Bug Report',
    state: 'open',
    created_at: '2024-10-03T12:00:00Z'
  }
};

logger.info('API Response:', response);
```

**Output**:
```
[DEBUG] [GitHub API] API Request:
{
  "method": "POST",
  "endpoint": "/repos/owner/repo/issues",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "title": "Bug Report",
    "labels": ["bug", "urgent"]
  }
}

[INFO] [GitHub API] API Response:
{
  "status": 201,
  "statusText": "Created",
  "data": {
    "id": 789,
    "number": 42,
    "title": "Bug Report",
    "state": "open",
    "created_at": "2024-10-03T12:00:00Z"
  }
}
```

---

### Example 4: Error Logging with Context

**✅ Code**:
```typescript
const logger = createScopedLogger('PaymentService');

try {
  await processPayment(paymentData);
} catch (error) {
  const context = {
    orderId: 'ORD-123',
    userId: 456,
    amount: 99.99,
    paymentMethod: 'credit_card',
    timestamp: new Date().toISOString()
  };
  
  logger.error('Payment processing failed:', context, error);
}
```

**Output**:
```
[ERROR] [PaymentService] Payment processing failed:
{
  "orderId": "ORD-123",
  "userId": 456,
  "amount": 99.99,
  "paymentMethod": "credit_card",
  "timestamp": "2024-10-03T12:00:00.000Z"
}
Error: Payment gateway timeout
    at processPayment (payment.ts:45:11)
    at async PaymentService.process (service.ts:123:5)
```

---

### Example 5: Mixed String and Object Arguments

**✅ Code**:
```typescript
const logger = createScopedLogger('UserService');

const userId = 123;
const updateData = { name: 'Jane Doe', email: 'jane@example.com' };
const timestamp = new Date();

logger.info('User updated:', userId, 'with data:', updateData, 'at', timestamp);
```

**Output**:
```
[INFO] [UserService] User updated: 123 with data:
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
at 2024-10-03T12:00:00.000Z
```

---

### Example 6: State Management Logging

**✅ Code**:
```typescript
const logger = createScopedLogger('Store');

const state = {
  user: { id: 123, name: 'John' },
  cart: {
    items: [
      { id: 1, name: 'Product A', quantity: 2 },
      { id: 2, name: 'Product B', quantity: 1 }
    ],
    total: 79.98
  },
  settings: {
    theme: 'dark',
    notifications: { email: true, push: false }
  }
};

logger.debug('Store state updated:', state);
```

**Output**:
```
[DEBUG] [Store] Store state updated:
{
  "user": {
    "id": 123,
    "name": "John"
  },
  "cart": {
    "items": [
      {
        "id": 1,
        "name": "Product A",
        "quantity": 2
      },
      {
        "id": 2,
        "name": "Product B",
        "quantity": 1
      }
    ],
    "total": 79.98
  },
  "settings": {
    "theme": "dark",
    "notifications": {
      "email": true,
      "push": false
    }
  }
}
```

---

## Log Level Filtering Examples

### Setting: `VITE_LOG_LEVEL=info`

**Code**:
```typescript
const logger = createScopedLogger('Service');

logger.debug('Debug message');  // ❌ Not shown
logger.info('Info message');    // ✅ Shown
logger.warn('Warning message'); // ✅ Shown
logger.error('Error message');  // ✅ Shown
```

**Output**:
```
[INFO] [Service] Info message
[WARN] [Service] Warning message
[ERROR] [Service] Error message
```

---

### Setting: `VITE_LOG_LEVEL=warn`

**Code**:
```typescript
logger.debug('Debug message');  // ❌ Not shown
logger.info('Info message');    // ❌ Not shown
logger.warn('Warning message'); // ✅ Shown
logger.error('Error message');  // ✅ Shown
```

**Output**:
```
[WARN] [Service] Warning message
[ERROR] [Service] Error message
```

---

### Setting: `VITE_LOG_LEVEL=none`

**Code**:
```typescript
logger.debug('Debug message');  // ❌ Not shown
logger.info('Info message');    // ❌ Not shown
logger.warn('Warning message'); // ❌ Not shown
logger.error('Error message');  // ❌ Not shown
```

**Output**:
```
(no output)
```

---

## Real-World Scenarios

### Scenario 1: Debugging a Complex Workflow

```typescript
const logger = createScopedLogger('CheckoutFlow');

// Step 1: Validate cart
const cart = { items: [...], total: 99.99 };
logger.debug('Validating cart:', cart);

// Step 2: Process payment
const paymentResult = await processPayment();
logger.info('Payment processed:', { transactionId: paymentResult.id, status: paymentResult.status });

// Step 3: Create order
const order = await createOrder();
logger.info('Order created:', { orderId: order.id, customerId: order.customerId });

// Step 4: Send confirmation
try {
  await sendConfirmationEmail(order);
  logger.info('Confirmation email sent:', { orderId: order.id, email: order.customerEmail });
} catch (error) {
  logger.error('Failed to send confirmation:', { orderId: order.id }, error);
}
```

### Scenario 2: Monitoring API Performance

```typescript
const logger = createScopedLogger('API Monitor');

async function monitoredApiCall(endpoint: string) {
  const startTime = Date.now();
  
  logger.debug('API call started:', { endpoint, timestamp: new Date().toISOString() });
  
  try {
    const response = await fetch(endpoint);
    const duration = Date.now() - startTime;
    
    const metrics = {
      endpoint,
      status: response.status,
      duration: `${duration}ms`,
      size: response.headers.get('content-length')
    };
    
    if (duration > 1000) {
      logger.warn('Slow API response:', metrics);
    } else {
      logger.info('API call completed:', metrics);
    }
    
    return response;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call failed:', {
      endpoint,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, error);
    throw error;
  }
}
```

---

## Tips for Effective Logging

1. **Use scoped loggers** for module identification
2. **Log objects directly** - the logger handles formatting
3. **Include timestamps** for time-sensitive operations
4. **Add context** to error logs for debugging
5. **Use appropriate levels** - debug for details, info for milestones
6. **Don't log sensitive data** - passwords, tokens, personal info
7. **Set production level to `info`** to reduce noise

---

**See also**:
- `LOGGER_USAGE_GUIDE.md` - Complete usage documentation
- `app/utils/logger.ts` - Source code with inline docs
- `LOGGER_MIGRATION_SUMMARY.md` - Migration details

