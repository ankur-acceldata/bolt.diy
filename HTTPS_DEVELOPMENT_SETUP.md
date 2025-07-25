# HTTPS Development with Custom Domains

This guide explains how to set up local HTTPS development with custom domains for the bolt.diy project.

## Quick Start

```bash
# 1. Add to your hosts file
echo "127.0.0.1   local.demo.xdp.acceldata.tech" | sudo tee -a /etc/hosts

# 2. Install mkcert (if not already installed)
brew install mkcert  # macOS
# or: choco install mkcert  # Windows

# 3. Install local CA (one-time setup)
mkcert -install

# 4. Generate SSL certificate
mkcert local.demo.xdp.acceldata.tech
mv local.demo.xdp.acceldata.tech*.pem certs/

# 5. Start development server
HOST=demo.xdp.acceldata.tech pnpm run dev:remote
```

Your app will be available at: `https://local.demo.xdp.acceldata.tech:5173`

## Detailed Setup

### 1. Prerequisites

#### Install mkcert

**macOS:**
```bash
brew install mkcert
```

**Windows:**
```bash
choco install mkcert
```

**Linux:**
```bash
curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
chmod +x mkcert-v*-linux-amd64
sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
```

#### Install Local Certificate Authority
```bash
mkcert -install
```

This installs a local CA that your browser will trust.

### 2. DNS Configuration

Add the development domain to your hosts file:

**macOS/Linux:**
```bash
sudo nano /etc/hosts
```

**Windows:**
```bash
# Run as Administrator
notepad C:\Windows\System32\drivers\etc\hosts
```

Add this line:
```
127.0.0.1   local.demo.xdp.acceldata.tech
```

### 3. SSL Certificate Generation

Generate the SSL certificate for your domain:

```bash
# From project root
mkcert local.demo.xdp.acceldata.tech

# Move certificates to certs directory
mv local.demo.xdp.acceldata.tech*.pem certs/
```

This creates:
- `certs/local.demo.xdp.acceldata.tech.pem` (certificate)
- `certs/local.demo.xdp.acceldata.tech-key.pem` (private key)

### 4. Running the Development Server

Use the new `dev:remote` script with the HOST environment variable:

```bash
HOST=demo.xdp.acceldata.tech pnpm run dev:remote
```

The server will automatically:
- Use the `local.{HOST}` pattern for the hostname
- Load the appropriate SSL certificates
- Configure HMR (Hot Module Replacement) to work with the custom domain
- Start on port 5173 (or use PORT environment variable)

### 5. Access Your Application

Open your browser and navigate to:
```
https://local.demo.xdp.acceldata.tech:5173
```

You should see:
- 🔒 Secure connection (green padlock)
- No SSL warnings
- Working hot-reload

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `HOST` | Base domain for development | - | `demo.xdp.acceldata.tech` |
| `PORT` | Development server port | `5173` | `3000` |

The development server will use `local.{HOST}` as the listening hostname.

## Troubleshooting

### Certificate Not Found
```
Error: ENOENT: no such file or directory, open 'certs/local.demo.xdp.acceldata.tech.pem'
```
**Solution:** Generate the SSL certificate as described in step 3.

### Browser Shows "Not Secure"
**Solution:** 
1. Make sure you ran `mkcert -install`
2. Regenerate the certificate: `mkcert local.demo.xdp.acceldata.tech`
3. Restart your browser

### Hot Reload Not Working
**Solution:** The HMR configuration should automatically work. If not:
1. Check that the domain in your browser matches the HOST environment variable
2. Verify the certificate is valid and trusted

### CORS Errors with External APIs
If you see CORS errors like:
```
Access to fetch at 'https://demo.xdp.acceldata.tech/dp/bhuvan-tanaya-pipeline-dp/fern-fs/api/health' from origin 'https://local.demo.xdp.acceldata.tech:5173' has been blocked by CORS policy
```

**Important**: Most `/api/*` endpoints are handled by **Remix**, not the Golang server. Only file sync operations should go to Golang.

**Architecture**:
- **Remix handles**: `/api/chat`, `/api/models`, `/api/health`, `/api/system/*`, etc.
- **Golang handles**: File operations via `/api/golang/*` proxy or server-side `/api/fern-sync`

**Solutions**:
1. **For file sync operations**: Use `/api/golang/*` endpoints (automatically proxied)
2. **For other APIs**: These should work normally as Remix routes
3. **If sync is failing**: Check that sync service is configured to use proxy endpoints

**Proxy Configuration**:
Only these endpoints are proxied to Golang server:
- `/api/golang/*` → `https://demo.xdp.acceldata.tech/dp/bhuvan-tanaya-pipeline-dp/fern-fs/api/*` 
- `/ws/golang/*` → `wss://demo.xdp.acceldata.tech/dp/bhuvan-tanaya-pipeline-dp/fern-fs/ws/*`

If you're still seeing CORS errors:
1. Make sure your Golang server is running on `localhost:8080`
2. Check that file sync is using `/api/golang/*` endpoints, not direct `localhost:8080` calls
3. Restart the development server after configuration changes

### Port Already in Use
**Solution:** Use a different port:
```bash
HOST=demo.xdp.acceldata.tech PORT=3000 pnpm run dev:remote
```

### Different Domain
To use a different domain (e.g., `my-app.local`):

1. Update hosts file:
   ```
   127.0.0.1   local.my-app.local
   ```

2. Generate certificate:
   ```bash
   mkcert local.my-app.local
   mv local.my-app.local*.pem certs/
   ```

3. Run with new HOST:
   ```bash
   HOST=my-app.local pnpm run dev:remote
   ```

## Security Notes

- SSL certificates are automatically git-ignored
- Certificates are only valid for local development
- The local CA is only trusted on your machine
- Never commit `.pem` files to version control

## Network Access

To access the development server from other devices on your network:

1. Find your machine's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig | findstr "IPv4"
   ```

2. Add the IP to other devices' hosts files:
   ```
   192.168.1.100   local.demo.xdp.acceldata.tech
   ```

3. Install the mkcert CA on those devices or accept the certificate warning. 