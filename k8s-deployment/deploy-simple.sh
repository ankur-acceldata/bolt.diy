#!/bin/bash

# Simple deployment script for XDP MCP Server
set -e

KUBECONFIG_FILE="/Users/ankuragarwal/Downloads/xdp-dev.yaml"
NAMESPACE="mcp-server"

echo "🚀 Deploying XDP MCP Server to xdp-dev cluster..."

# Set kubeconfig
export KUBECONFIG="$KUBECONFIG_FILE"

# Check cluster connectivity
echo "📡 Testing cluster connectivity..."
if ! kubectl cluster-info > /dev/null 2>&1; then
    echo "❌ Cannot connect to cluster. Please check your kubeconfig."
    exit 1
fi

echo "✅ Connected to cluster: $(kubectl config current-context)"
echo "📁 Using namespace: $NAMESPACE"

# Prompt for XDP API credentials
echo ""
echo "🔑 Please provide XDP API credentials:"
read -p "Enter XDP Access Key: " XDP_ACCESS_KEY
read -s -p "Enter XDP Secret Key: " XDP_SECRET_KEY
echo ""

if [ -z "$XDP_ACCESS_KEY" ] || [ -z "$XDP_SECRET_KEY" ]; then
    echo "❌ Both access key and secret key are required!"
    exit 1
fi

# Encode credentials to base64
XDP_ACCESS_KEY_B64=$(echo -n "$XDP_ACCESS_KEY" | base64)
XDP_SECRET_KEY_B64=$(echo -n "$XDP_SECRET_KEY" | base64)

echo "🔧 Creating temporary secrets file..."
cat > temp-secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: xdp-mcp-server-secrets
  namespace: $NAMESPACE
type: Opaque
data:
  XDP_ACCESS_KEY: $XDP_ACCESS_KEY_B64
  XDP_SECRET_KEY: $XDP_SECRET_KEY_B64
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: xdp-mcp-server-config
  namespace: $NAMESPACE
data:
  XDP_BASE_URL: "https://demo.xdp-playground.acceldata.tech/xdp-cp-service/api"
  BOLT_API_URL: "http://bolt-diy-service:5173"
  NODE_ENV: "production"
EOF

# Deploy resources
echo "📦 Deploying resources..."

echo "  - Creating ConfigMaps with source code..."
kubectl apply -f source-configmap.yaml -n $NAMESPACE
kubectl apply -f package-configmap.yaml -n $NAMESPACE

echo "  - Applying secrets and config..."
kubectl apply -f temp-secret.yaml -n $NAMESPACE

echo "  - Deploying application..."
kubectl apply -f deployment-simple.yaml -n $NAMESPACE

echo "  - Creating service..."
kubectl apply -f service-simple.yaml -n $NAMESPACE

# Wait for deployment
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/xdp-mcp-server -n $NAMESPACE --timeout=300s

# Check pod status
echo "🔍 Checking pod status..."
kubectl get pods -l app=xdp-mcp-server -n $NAMESPACE

# Get service information
echo ""
echo "🌐 Service information:"
kubectl get services -l app=xdp-mcp-server -n $NAMESPACE

# Try to get external IP for LoadBalancer
echo ""
echo "⏳ Waiting for LoadBalancer external IP (this may take a few minutes)..."
for i in {1..30}; do
    EXTERNAL_IP=$(kubectl get service xdp-mcp-server-lb -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [ -n "$EXTERNAL_IP" ]; then
        echo "✅ External IP assigned: $EXTERNAL_IP"
        break
    fi
    echo "  Still waiting for external IP... ($i/30)"
    sleep 10
done

# Show logs
echo ""
echo "📝 Recent logs:"
kubectl logs -l app=xdp-mcp-server -n $NAMESPACE --tail=20

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📋 Access information:"
if [ -n "$EXTERNAL_IP" ]; then
    echo "  External URL: http://$EXTERNAL_IP"
    echo "  Health check: http://$EXTERNAL_IP/health"
    echo "  Server info: http://$EXTERNAL_IP/info"
else
    echo "  LoadBalancer IP not yet assigned. Use port-forward:"
    echo "  kubectl port-forward service/xdp-mcp-server-service 8080:8080 -n $NAMESPACE"
fi
echo ""
echo "📋 Useful commands:"
echo "  View logs: kubectl logs -f -l app=xdp-mcp-server -n $NAMESPACE"
echo "  Check status: kubectl get pods -l app=xdp-mcp-server -n $NAMESPACE"
echo "  Port forward: kubectl port-forward service/xdp-mcp-server-service 8080:8080 -n $NAMESPACE"
echo "  Scale: kubectl scale deployment xdp-mcp-server --replicas=2 -n $NAMESPACE"
echo "  Delete: kubectl delete deployment xdp-mcp-server -n $NAMESPACE"
echo ""

# Cleanup temp file
rm -f temp-secret.yaml

echo "🎉 XDP MCP Server is now running in the Kubernetes cluster!"