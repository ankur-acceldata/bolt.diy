# 🎯 Default Base Path Configuration

## ✅ **Now Active: `/ai-editor` as Default**

Your application now uses `/ai-editor` as the **default base path** without needing any environment variables!

## 🚀 **Simple Usage**

### **Just Run Development (No ENV needed!)**
```bash
# Simple command - automatically uses /ai-editor
pnpm dev

# Or with specific host/port
pnpm dev --host 0.0.0.0 --port 5173
```

**Result:** Application runs at `http://localhost:5173/ai-editor/`

### **Override the Default (when needed)**
```bash
# Use a different base path
BASE_PATH="/custom-path" pnpm dev

# Use root deployment (no base path)
BASE_PATH="" pnpm dev

# Use root deployment (alternative)
BASE_PATH="/" pnpm dev
```

## 🐳 **Docker with Defaults**

### **Simple Docker Build & Run**
```bash
# Build with default /ai-editor
docker build -t bolt-ai:latest .

# Run with defaults
docker run -p 5173:5173 bolt-ai:latest
```

**Result:** Container runs with `/ai-editor` base path automatically

### **Override Docker Defaults**
```bash
# Build with different defaults
docker build --build-arg BASE_PATH="/custom" -t bolt-ai:custom .

# Runtime override
docker run -e BASE_PATH="/different" -p 5173:5173 bolt-ai:latest
```

## 🏗️ **Kubernetes Pod Configuration**

### **Simple Pod (Uses Defaults)**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bolt-ai
spec:
  template:
    spec:
      containers:
      - name: bolt-ai
        image: bolt-ai:latest
        ports:
        - containerPort: 5173
        # No environment variables needed!
        # Automatically uses /ai-editor
```

### **Pod with Custom Base Path**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bolt-ai
spec:
  template:
    spec:
      containers:
      - name: bolt-ai
        image: bolt-ai:latest
        ports:
        - containerPort: 5173
        env:
        - name: BASE_PATH
          value: "/custom-path"  # Override default
```

## 📋 **Configuration Priority**

1. **Environment Variables** (highest priority)
   - `BASE_PATH=/custom` → Uses `/custom`
   - `VITE_BASE_PATH=/custom` → Uses `/custom`

2. **Default Value** (when no env vars set)
   - Automatically uses `/ai-editor`

3. **Explicit Empty** (for root deployment)
   - `BASE_PATH=""` → Uses root `/`
   - `BASE_PATH="/"` → Uses root `/`

## 🔧 **What Was Changed**

### **Files Updated:**

1. **`app/lib/config.ts`**
   ```typescript
   // OLD: const basePath = config.basePath || '/';
   // NEW: const basePath = config.basePath || '/ai-editor';
   ```

2. **`vite.config.ts`**
   ```typescript
   // OLD: const BASE_PATH = env.BASE_PATH || env.VITE_BASE_PATH || '';
   // NEW: const BASE_PATH = env.BASE_PATH || env.VITE_BASE_PATH || '/ai-editor';
   ```

3. **`Dockerfile`**
   ```dockerfile
   # OLD: ARG BASE_PATH
   # NEW: ARG BASE_PATH=/ai-editor
   ```

## ✅ **Testing Results**

- ✅ `pnpm dev` → Serves at `http://localhost:5173/ai-editor/`
- ✅ All static assets load correctly
- ✅ WebContainer inspector script works
- ✅ API endpoints use correct base path
- ✅ No environment variables required

## 🎉 **Benefits**

### **Developer Experience**
- **No setup required** - just run `pnpm dev`
- **Consistent across environments**
- **Backwards compatible** - can still override

### **Deployment Simplicity**
- **Docker containers work out-of-the-box**
- **Kubernetes pods need no configuration**
- **Production builds use correct paths**

### **Team Collaboration**
- **Same experience for everyone**
- **No need to remember environment variables**
- **Documentation is simpler**

## 🚀 **Quick Start Commands**

```bash
# Development (automatic /ai-editor)
pnpm dev

# Production build (automatic /ai-editor)
pnpm build

# Docker (automatic /ai-editor)
docker build -t bolt-ai . && docker run -p 5173:5173 bolt-ai

# Kubernetes (automatic /ai-editor)
kubectl apply -f your-deployment.yaml
```

Your application is now **ready to run** with `/ai-editor` as the default base path in all environments! 🎉