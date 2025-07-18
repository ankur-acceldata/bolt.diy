# Fern-FS Sync Configuration

This document explains how to configure the Golang API server with Minio storage for seamless file synchronization with bolt.diy.

## Quick Start

1. **Start Minio Server** (if not already running):
```bash
# Using Docker
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

2. **Configure Golang Server Environment**:
```bash
export STORAGE_TYPE=minio
export S3_ENDPOINT=localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=fern-fs-bucket
export PORT=8080
```

3. **Start Golang Server**:
```bash
cd /Users/ankuragarwal/src/fern-fs/server
go run cmd/server/main.go
```

4. **Enable Sync in bolt.diy**:
   - Go to Settings → Features → Beta Features
   - Toggle "File Sync" ON
   - Toggle "Auto Sync" ON
   - Set "Golang API Server URL" to: `http://localhost:8080`
   - Set "Auto-save Interval" to: `5000` (5 seconds, recommended)

## Configuration Details

### Minio Storage Backend

The Golang server supports multiple storage backends. For Minio integration:

**Environment Variables:**
```bash
STORAGE_TYPE=minio           # Use Minio as storage backend
S3_ENDPOINT=localhost:9000   # Minio server endpoint
S3_ACCESS_KEY=minioadmin     # Minio access key
S3_SECRET_KEY=minioadmin     # Minio secret key  
S3_BUCKET=fern-fs-bucket     # Bucket name for file storage
S3_USE_SSL=false             # Use HTTPS (set to true for production)
```

### Golang Server Configuration

**Default Server Settings:**
```bash
PORT=8080                    # HTTP server port
LOG_LEVEL=info              # Logging level (debug, info, warn, error)
CORS_ORIGIN=*               # CORS allowed origins
```

**WebSocket Configuration:**
```bash
WS_READ_BUFFER_SIZE=1024    # WebSocket read buffer size
WS_WRITE_BUFFER_SIZE=1024   # WebSocket write buffer size
WS_CHECK_ORIGIN=false       # Check WebSocket origin (set true for production)
```

## API Endpoints

The Golang server provides these endpoints for file operations:

### File Operations
- `GET /api/health` - Health check
- `GET /api/files` - List all files
- `GET /api/files/{path}` - Get specific file content
- `POST /api/files/{path}` - Create or update file
- `DELETE /api/files/{path}` - Delete file
- `PUT /api/files/move` - Move/rename file

### Sync Operations
- `GET /api/sync/manifest` - Get file manifest for sync
- `POST /api/deploy` - Deploy files
- `WS /ws` - WebSocket for real-time sync

## bolt.diy Sync Features

### Auto-save Functionality
- Files are automatically saved 2 seconds after editing stops
- No browser permissions required
- Background synchronization with visual feedback
- Real-time sync with Golang API and Minio storage

### Sync Settings
- **File Sync**: Enable/disable sync functionality
- **Auto Sync**: Enable/disable automatic synchronization  
- **Auto-save Interval**: How often to check for changes (minimum 1000ms, recommended 5000ms)
- **Golang API Server URL**: URL of your Golang server (default: http://localhost:8080)

### WebSocket Features
- Real-time file change notifications
- Automatic reconnection with exponential backoff
- Connection status monitoring
- Instant sync status updates

## Troubleshooting

### Common Issues

1. **"Fern API server is not available"**
   - Check if Golang server is running on port 8080
   - Verify the server URL in sync settings
   - Check network connectivity

2. **"Failed to save file to Fern API"**
   - Check Minio server is running and accessible
   - Verify Minio credentials and bucket configuration
   - Check Golang server logs for errors

3. **"WebSocket connection failed"**
   - Ensure WebSocket endpoint is accessible
   - Check for firewall or proxy issues
   - Verify CORS configuration in Golang server

### Verification Steps

1. **Check Minio**: Visit http://localhost:9001 (Minio console)
2. **Check Golang API**: Visit http://localhost:8080/api/health
3. **Check Sync Status**: View Event Logs in bolt.diy settings
4. **Check Files**: Verify files appear in Minio bucket

## Production Deployment

For production use:

1. **Use HTTPS/WSS**:
```bash
S3_USE_SSL=true
WS_CHECK_ORIGIN=true
CORS_ORIGIN=https://your-domain.com
```

2. **Secure Minio**:
   - Use strong access credentials
   - Enable TLS encryption
   - Configure proper network security

3. **Monitor Performance**:
   - Set appropriate buffer sizes
   - Monitor file sync latency
   - Configure logging levels

## File Structure

Synced files are stored in Minio with the following structure:
```
fern-fs-bucket/
├── project-files/
│   ├── src/
│   │   ├── components/
│   │   └── utils/
│   ├── package.json
│   └── README.md
└── .metadata/
    ├── manifest.json
    └── sync-state.json
```

## Support

For issues and questions:
- Check Golang server logs for detailed error messages
- Enable debug logging: `LOG_LEVEL=debug`
- Review bolt.diy Event Logs in Settings
- Verify Minio bucket permissions and connectivity