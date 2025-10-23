# Quick Fix Guide

## Issues Found

1. **Health check failing** - The Docker health check was using an unreliable Node.js one-liner
2. **Troubleshoot script bug** - PORT variable extraction was broken

## What I Fixed

### 1. Dockerfile Health Check
- Changed from Node.js `require('http')` to `wget` (more reliable)
- Added `wget` to the Alpine image
- Health check now properly detects if server is responding

### 2. Troubleshoot Script
- Fixed PORT variable extraction to avoid grabbing MCP_TRANSPORT value
- Now correctly shows port 3002

## How to Apply the Fix

### Step 1: Rebuild the Docker Image

```bash
cd /docker/outage-monitor-mcp
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Step 2: Verify Health Check

Wait about 10-15 seconds for the health check to run, then check:

```bash
docker ps
```

Look for the STATUS column - it should show "healthy" after a few seconds.

### Step 3: Run Troubleshoot Script Again

```bash
./troubleshoot.sh
```

You should now see:
- ✓ Container is healthy
- ✓ Server responds to internal health check
- ✓ n8n can reach MCP server

## Why This Happened

The original health check was:
```dockerfile
CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

This was unreliable because:
- Complex callback handling in a one-liner
- Error handling issues
- Timing issues with the response

The new health check is:
```dockerfile
CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
```

This is:
- Simple and reliable
- Uses standard HTTP tools
- Properly reports success/failure

## Your Server IS Working!

From your logs, I can see the server IS running correctly:
```
Outage Monitor MCP Server running on http://0.0.0.0:3002
MCP request received: initialize
Using bearer token from Authorization header
```

The only issue was the health check itself, not the actual server functionality.

After rebuilding, n8n should be able to connect successfully!
