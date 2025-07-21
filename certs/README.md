# Local HTTPS Development Setup

This directory contains SSL certificates for local HTTPS development with custom domains.

## Prerequisites

1. **Install mkcert** (one-time setup):
   ```bash
   # macOS
   brew install mkcert
   
   # Windows
   choco install mkcert
   
   # Linux
   curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
   chmod +x mkcert-v*-linux-amd64
   sudo cp mkcert-v*-linux-amd64 /usr/local/bin/mkcert
   ```

2. **Install local CA** (one-time setup):
   ```bash
   mkcert -install
   ```

## Setup for Custom Domain Development

### 1. Add DNS Entry

Add this line to your hosts file:

**macOS/Linux**: `/etc/hosts`
**Windows**: `C:\Windows\System32\drivers\etc\hosts`

```
127.0.0.1   local.demo.xdp.acceldata.tech
```

### 2. Generate SSL Certificate

Run this command from the project root:

```bash
mkcert local.demo.xdp.acceldata.tech
mv local.demo.xdp.acceldata.tech*.pem certs/
```

This will generate:
- `certs/local.demo.xdp.acceldata.tech.pem` (certificate)
- `certs/local.demo.xdp.acceldata.tech-key.pem` (private key)

### 3. Run Development Server

```bash
HOST=demo.xdp.acceldata.tech pnpm run dev:remote
```

The server will be available at: `https://local.demo.xdp.acceldata.tech:5173`

## Notes

- The certificates are git-ignored for security
- You'll need to regenerate certificates if you change the domain
- The `dev:remote` script automatically uses the `local.{HOST}` pattern 