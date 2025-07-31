# Golang API Sync Testing Guide

This guide will help you test the newly implemented Golang API sync functionality that replaces the browser file system access with automatic synchronization to Minio storage.

## Prerequisites

### 1. Set up Minio Server
```bash
# Using Docker (recommended)
docker run -p 9000:9000 -p 9001:9001 \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  minio/minio server /data --console-address ":9001"
```

### 2. Configure Golang Server
```bash
# Set environment variables
export STORAGE_TYPE=minio
export S3_ENDPOINT=localhost:9000
export S3_ACCESS_KEY=minioadmin
export S3_SECRET_KEY=minioadmin
export S3_BUCKET=fern-fs-bucket
export PORT=8080
export LOG_LEVEL=debug

# Start the Golang server
cd /Users/ankuragarwal/src/fern-fs/server
go run cmd/server/main.go
```

### 3. Start bolt.diy Development Server
```bash
cd /Users/ankuragarwal/src/bolt.diy
npm run dev
```

## Testing Steps

### Phase 1: Basic Configuration

1. **Open bolt.diy in browser**
   - Navigate to `http://localhost:5173`

2. **Enable Sync Feature**
   - Go to Settings → Features → Beta Features
   - Toggle **"File Sync"** to ON
   - Toggle **"Auto Sync"** to ON
   - Set **"Golang API Server URL"** to: `http://localhost:8080`
   - Set **"Auto-save Interval"** to: `5000` (5 seconds)

3. **Verify Server Connection**
   - Check that the sync service initializes without errors
   - Look for success toast: "File sync enabled with Golang API"

### Phase 2: Manual Sync Testing

1. **Create a Test Project**
   - Start a new chat in bolt.diy
   - Ask Claude to create a simple React app or any project

2. **Test Manual Sync**
   - Look for the sync button in the workbench header (should show "Sync to Golang API")
   - Click the sync button
   - Verify you see "Syncing to Minio..." status
   - Check for success toast: "Files synced successfully to Golang API and Minio storage"

3. **Verify Files in Minio**
   - Open Minio console at `http://localhost:9001`
   - Login with `minioadmin` / `minioadmin`
   - Check the `fern-fs-bucket` bucket for your files
   - Files should appear in the bucket with proper directory structure

### Phase 3: Auto-Save Testing

1. **Edit a File**
   - Open any file in the bolt.diy editor
   - Make some changes to the content
   - Wait 2 seconds (auto-save debounce time)

2. **Check Auto-Save Logs**
   - Open browser dev tools → Console
   - Look for log messages like: "Auto-saved file: /path/to/file.ext"
   - Check the Event Logs in Settings → Features for sync activities

3. **Verify Auto-Save in Minio**
   - Check Minio console to see if the file was automatically updated
   - The file content should reflect your changes

### Phase 4: Real-time Sync Testing

1. **Create Multiple Files**
   - Create or modify several files in the workbench
   - Each file should trigger auto-save after 2 seconds

2. **Test WebSocket Connection**
   - The sync service should establish a WebSocket connection
   - Look for console messages about WebSocket connection status

3. **Verify Continuous Sync**
   - Continue editing files and observe automatic synchronization
   - Check that the sync status shows real-time updates

## Expected Behaviors

### ✅ Success Indicators

1. **Sync Button Behavior**
   - Button text: "Sync to Golang API" (not "Sync Files")
   - No browser file dialog appears
   - Shows "Syncing to Minio..." during sync
   - Success toast appears after sync

2. **Auto-Save Behavior**
   - Files auto-save 2 seconds after editing stops
   - Console shows "Auto-saved file: ..." messages
   - No manual save actions required

3. **Minio Storage**
   - Files appear in `fern-fs-bucket`
   - Directory structure is preserved
   - Content matches what's in the editor

4. **WebSocket Connection**
   - Real-time sync status updates
   - Automatic reconnection on connection loss
   - Live file change notifications

### ❌ Error Indicators

1. **Browser File Dialog**
   - If the old browser file picker appears, sync integration failed
   - Should show error: "File sync is not enabled"

2. **Connection Errors**
   - "Sync service is not initialized" error
   - "Failed to sync files to Golang API" error
   - WebSocket connection failures

3. **Minio Issues**
   - Files not appearing in Minio bucket
   - Incorrect file content or structure
   - API server connection errors

## Troubleshooting

### Common Issues

1. **"File sync is not enabled"**
   - Solution: Enable sync in Settings → Features → Beta Features

2. **"Sync service is not initialized"**
   - Check Golang server is running on port 8080
   - Verify server URL in settings
   - Check browser console for initialization errors

3. **"Failed to sync files to Golang API"**
   - Verify Minio server is running
   - Check S3 credentials and bucket configuration
   - Look at Golang server logs for errors

4. **Auto-save not working**
   - Check if auto-sync is enabled in settings
   - Verify sync interval is set correctly
   - Look for file watching errors in console

### Debug Steps

1. **Check Browser Console**
   - Look for sync-related error messages
   - Check WebSocket connection status
   - Monitor auto-save log messages

2. **Check Golang Server Logs**
   - Should show API requests from bolt.diy
   - File upload/download operations
   - WebSocket connection events

3. **Check Minio Server**
   - Verify bucket exists and is accessible
   - Check file timestamps match edit times
   - Ensure proper permissions

## Configuration Files

- **bolt.diy Settings**: Managed through UI (Settings → Features)
- **Golang Server Config**: Environment variables listed above
- **Minio Config**: Set via Docker environment variables
- **Sync Documentation**: See `/Users/ankuragarwal/src/bolt.diy/FERN_SYNC_CONFIG.md`

## API Endpoints

Test these endpoints to verify server functionality:

- `GET http://localhost:8080/api/health` - Server health check
- `GET http://localhost:8080/api/files` - List all files
- `POST http://localhost:8080/api/files/{path}` - Upload file
- `GET http://localhost:8080/api/sync/manifest` - Get sync manifest
- `WS ws://localhost:8080/ws` - WebSocket connection

## Performance Expectations

- **Auto-save delay**: 2 seconds after editing stops
- **Sync interval**: 5 seconds (configurable)
- **WebSocket reconnection**: Automatic with exponential backoff
- **File upload**: Should complete within a few seconds for typical files

## Success Criteria

✅ **Phase 1**: Sync feature enabled without browser file dialog
✅ **Phase 2**: Manual sync works and files appear in Minio
✅ **Phase 3**: Auto-save triggers automatically on file edits
✅ **Phase 4**: Real-time sync and WebSocket connection work
✅ **Overall**: Complete replacement of browser file system with Golang API

If all phases pass, the implementation is successful and ready for production use.