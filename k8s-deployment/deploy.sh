#!/bin/bash

# Deploy XDP MCP Server to Kubernetes
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

# Prompt for XDP API credentials if not provided
if [ -z "$XDP_ACCESS_KEY" ] || [ -z "$XDP_SECRET_KEY" ]; then
    echo "🔑 XDP API credentials required..."
    read -p "Enter XDP Access Key: " XDP_ACCESS_KEY
    read -s -p "Enter XDP Secret Key: " XDP_SECRET_KEY
    echo ""
fi

# Encode credentials to base64
XDP_ACCESS_KEY_B64=$(echo -n "$XDP_ACCESS_KEY" | base64)
XDP_SECRET_KEY_B64=$(echo -n "$XDP_SECRET_KEY" | base64)

# Update secret.yaml with actual credentials
echo "🔧 Updating credentials in secret.yaml..."
sed -i.bak "s/UkVQTEFDRV9XSVRIX0FDVFVBTF9BQ0NFU1NfS0VZ/$XDP_ACCESS_KEY_B64/g" secret.yaml
sed -i.bak "s/UkVQTEFDRV9XSVRIX0FDVFVBTF9TRUNSRVRfS0VZ/$XDP_SECRET_KEY_B64/g" secret.yaml

# Apply manifests
echo "📦 Deploying resources to namespace: $NAMESPACE..."

echo "  - Applying secrets and config..."
kubectl apply -f secret.yaml -n $NAMESPACE

echo "  - Applying deployment..."
kubectl apply -f deployment.yaml -n $NAMESPACE

echo "  - Applying service..."
kubectl apply -f service.yaml -n $NAMESPACE

# Wait for deployment
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/xdp-mcp-server -n $NAMESPACE --timeout=300s

# Check pod status
echo "🔍 Checking pod status..."
kubectl get pods -l app=xdp-mcp-server -n $NAMESPACE

# Get service information
echo "🌐 Service information:"
kubectl get service xdp-mcp-server-service -n $NAMESPACE

# Show logs
echo "📝 Recent logs:"
kubectl logs -l app=xdp-mcp-server -n $NAMESPACE --tail=20

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Useful commands:"
echo "  View logs: kubectl logs -f -l app=xdp-mcp-server -n $NAMESPACE"
echo "  Check status: kubectl get pods -l app=xdp-mcp-server -n $NAMESPACE"
echo "  Port forward: kubectl port-forward service/xdp-mcp-server-service 3000:3000 -n $NAMESPACE"
echo "  Delete: kubectl delete -f . -n $NAMESPACE"
echo ""

# Cleanup temp files
rm -f secret.yaml.bak

echo "🎉 XDP MCP Server is now running in the cluster!"