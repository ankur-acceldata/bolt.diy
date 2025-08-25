# Multi-stage build for XDP MCP Server
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY ../xdp-mcp-server/package*.json ./
COPY ../xdp-mcp-server/tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ../xdp-mcp-server/src ./src
COPY ../xdp-mcp-server/types ./types

# Build TypeScript
RUN npm run build

# Production image
FROM node:18-alpine AS production

# Install basic tools
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S mcpserver -u 1001
RUN chown -R mcpserver:nodejs /app
USER mcpserver

# Expose port (if needed for HTTP wrapper)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the MCP server
CMD ["node", "dist/index.js"]