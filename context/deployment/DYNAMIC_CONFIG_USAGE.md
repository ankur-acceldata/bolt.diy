# Dynamic Base Path and Host Configuration - Usage Guide

This guide demonstrates how to use the new dynamic configuration system for flexible deployment scenarios.

## 🎯 Overview

The application now supports completely dynamic configuration for:
- **Base Path**: Deploy at any URL path (e.g., `/ai-editor`, `/my-app`, or root `/`)
- **Host**: Configure for any hostname without hardcoding
- **Port**: Use any port for development or production

## 🚀 Getting Started

### 1. Root Deployment (Simplest)

```bash
# No configuration needed - works at domain root
npm run build
npm run start

# Access at: https://yourdomain.com/
```

### 2. Sub-path Deployment

```bash
# Deploy at a specific path
export BASE_PATH="/ai-editor"
npm run build
npm run start

# Access at: https://yourdomain.com/ai-editor/
```

### 3. Custom Configuration

```bash
# Full custom setup
export BASE_PATH="/my-app"
export HOST="app.company.com" 
export PORT=8080
npm run build
npm run start

# Access at: https://app.company.com:8080/my-app/
```

## 🐳 Docker Usage Examples

### Basic Docker Build and Run

```bash
# Build with configuration
docker build \
  --build-arg BASE_PATH="/ai-tools" \
  --build-arg HOST="tools.company.com" \
  --build-arg PORT=3000 \
  -t my-bolt-app .

# Run with port mapping
docker run -p 3000:3000 my-bolt-app

# Access at: http://localhost:3000/ai-tools/
```

### Runtime Configuration with Docker

```bash
# Override configuration at runtime
docker run \
  -e BASE_PATH="/different-path" \
  -e HOST="localhost" \
  -e PORT=8080 \
  -p 8080:8080 \
  my-bolt-app

# Access at: http://localhost:8080/different-path/
```

### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'
services:
  bolt-ai:
    build:
      context: .
      args:
        BASE_PATH: "/ai-assistant"
        HOST: "ai.company.com"
        PORT: 8080
    environment:
      - BASE_PATH=/ai-assistant
      - HOST=ai.company.com
      - PORT=8080
      # Add your API keys
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    ports:
      - "8080:8080"
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
# Access at: http://localhost:8080/ai-assistant/
```

## ☁️ Cloud Deployment Examples

### Cloudflare Pages

Set environment variables in your Pages dashboard:

```
BASE_PATH = /ai-editor
```

Update `wrangler.toml` if needed:
```toml
[vars]
BASE_PATH = "/ai-editor"

[[pages.rules]]
pattern = "/ai-editor/*"
priority = 100
```

### AWS/Azure/GCP with Reverse Proxy

If deploying behind a reverse proxy:

```bash
# App runs on internal port with base path
export BASE_PATH="/ai-tools"
export PORT=3000
npm run build
npm run start

# Nginx config example:
# location /ai-tools/ {
#     proxy_pass http://localhost:3000/ai-tools/;
# }
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bolt-ai
spec:
  replicas: 2
  selector:
    matchLabels:
      app: bolt-ai
  template:
    metadata:
      labels:
        app: bolt-ai
    spec:
      containers:
      - name: bolt-ai
        image: my-bolt-app:latest
        env:
        - name: BASE_PATH
          value: "/ai-tools"
        - name: PORT
          value: "3000"
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: Service
metadata:
  name: bolt-ai-service
spec:
  selector:
    app: bolt-ai
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
```

## 🔧 Development Configurations

### Local Development Variations

#### 1. Standard Development
```bash
npm run dev
# Runs at: http://localhost:5173/
```

#### 2. With Base Path
```bash
export BASE_PATH="/dev"
npm run dev
# Runs at: http://localhost:5173/dev/
```

#### 3. Custom Port
```bash
export PORT=8080
npm run dev
# Runs at: http://localhost:8080/
```

#### 4. HTTPS Development
```bash
export HOST="local.myapp.com"
export BASE_PATH="/dev"
npm run dev
# Runs at: https://local.myapp.com:5173/dev/
# (requires SSL certificates - see HTTPS_DEVELOPMENT_SETUP.md)
```

### Environment File Setup

Create `.env.local`:
```bash
# Development configuration
BASE_PATH=/ai-editor
HOST=localhost
PORT=5173

# API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# Development settings
VITE_LOG_LEVEL=debug
```

## 📋 Real-World Scenarios

### Scenario 1: Multiple Environments

```bash
# Development
export BASE_PATH="/dev"
export HOST="dev.company.com"

# Staging  
export BASE_PATH="/staging"
export HOST="staging.company.com"

# Production
export BASE_PATH=""  # Root deployment
export HOST="ai.company.com"
```

### Scenario 2: Multi-tenant Deployment

```bash
# Tenant A
export BASE_PATH="/tenant-a"
docker run -e BASE_PATH="/tenant-a" -p 3001:5173 bolt-ai

# Tenant B  
export BASE_PATH="/tenant-b"
docker run -e BASE_PATH="/tenant-b" -p 3002:5173 bolt-ai

# Access:
# - http://localhost:3001/tenant-a/
# - http://localhost:3002/tenant-b/
```

### Scenario 3: Corporate Deployment

```bash
# Build for corporate intranet
docker build \
  --build-arg BASE_PATH="/ai-tools" \
  --build-arg HOST="intranet.corp.com" \
  --build-arg PORT=8080 \
  -t bolt-ai:corporate .

# Deploy with additional security
docker run \
  -e BASE_PATH="/ai-tools" \
  -e HOST="intranet.corp.com" \
  -p 8080:8080 \
  --restart=always \
  bolt-ai:corporate
```

## 🔍 Debugging Configuration

### Check Current Configuration

Add this to your browser console:
```javascript
import { getConfigSummary } from '/ai-editor/build/assets/config-123.js';
console.log('Current Config:', getConfigSummary());
```

### Debug API Calls

The system automatically handles API routing. Check network tab for:
- ✅ API calls going to `/your-base-path/api/...`
- ✅ Assets loading from `/your-base-path/assets/...`
- ❌ 404s on incorrect paths

### Environment Variable Verification

```bash
# Check what's being used
echo "BASE_PATH: $BASE_PATH"
echo "HOST: $HOST"  
echo "PORT: $PORT"

# Inside container
docker exec container_name env | grep -E "(BASE_PATH|HOST|PORT)"
```

## ⚠️ Common Pitfalls

### 1. Mismatched Build vs Runtime Config

```bash
# ❌ Wrong: Different BASE_PATH between build and runtime
export BASE_PATH="/build-path"
npm run build
export BASE_PATH="/runtime-path"  # This will cause issues
npm run start

# ✅ Correct: Same BASE_PATH for build and runtime
export BASE_PATH="/my-app"
npm run build
npm run start
```

### 2. Docker Port Mismatch

```bash
# ❌ Wrong: PORT env doesn't match exposed port
docker run -e PORT=3000 -p 8080:5173 bolt-ai  # Broken

# ✅ Correct: Consistent PORT configuration
docker run -e PORT=3000 -p 3000:3000 bolt-ai
```

### 3. Missing Trailing Slash Handling

The system automatically handles trailing slashes, but ensure your reverse proxy does too:

```nginx
# Nginx example
location /ai-tools/ {
    proxy_pass http://localhost:3000/ai-tools/;
    # This trailing slash is important ----^
}
```

## 🎉 Migration from Fixed Paths

If migrating from hardcoded `/ai-editor`:

1. **Update deployment scripts**:
   ```bash
   # Old way
   # Fixed to /ai-editor
   
   # New way  
   export BASE_PATH="/ai-editor"  # or any path you want
   ```

2. **Update Docker files**:
   ```dockerfile
   # Old way
   ENV BASE_PATH="/ai-editor"
   
   # New way
   ARG BASE_PATH
   ENV BASE_PATH=${BASE_PATH}
   ```

3. **Update CI/CD**:
   ```yaml
   # GitHub Actions example
   - name: Deploy
     env:
       BASE_PATH: ${{ secrets.BASE_PATH }}
       HOST: ${{ secrets.HOST }}
     run: |
       npm run build
       npm run deploy
   ```

The new system is fully backward compatible - existing deployments will continue working without changes!