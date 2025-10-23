# Troubleshooting Guide - n8n to MCP Server Connection

This guide helps diagnose and fix connection issues between n8n and the MCP server when both are running in Docker.

## Quick Diagnostics

Run the automated troubleshooting script:

```bash
chmod +x troubleshoot.sh
./troubleshoot.sh
```

This will check:
- Container status and health
- Network connectivity
- Port configuration
- Authentication setup
- Endpoint accessibility

## Manual Troubleshooting Steps

### 1. Verify Both Containers Are Running

```bash
# Check MCP server
docker ps | grep outage-monitor-mcp

# Check n8n
docker ps | grep n8n
```

**Expected**: Both containers should be listed and status should be "Up"

**If MCP server is not running:**
```bash
cd /path/to/outage-monitor-mcp
docker-compose up -d
```

### 2. Check Container Logs

```bash
# MCP server logs
docker logs outage-monitor-mcp

# Live logs (watch in real-time)
docker logs -f outage-monitor-mcp

# n8n logs
docker logs n8n
```

**Look for:**
- ✓ "Outage Monitor MCP Server running on http://0.0.0.0:3002"
- ✓ "Authentication: Bearer token (Authorization header) or environment variable"
- ✗ Error messages
- ✗ Port conflicts

### 3. Verify Network Configuration

Check which networks the containers are on:

```bash
# MCP server networks
docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'

# n8n networks
docker inspect n8n --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

**They MUST share at least one network!**

**If they don't share a network:**

Option A: Connect n8n to MCP network
```bash
NETWORK=$(docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' | awk '{print $1}')
docker network connect $NETWORK n8n
```

Option B: Create a shared network
```bash
# Create network
docker network create mcp-n8n-network

# Connect both containers
docker network connect mcp-n8n-network outage-monitor-mcp
docker network connect mcp-n8n-network n8n
```

### 4. Test Internal Connectivity

From inside the MCP container:

```bash
# Test health endpoint
docker exec outage-monitor-mcp wget -q -O - http://localhost:3002/health

# Expected output: {"status":"ok","server":"outage-monitor-mcp",...}
```

From inside the n8n container:

```bash
# Test by container name
docker exec n8n wget -q -O - http://outage-monitor-mcp:3002/health

# Test by IP (replace with actual IP from step 3)
docker exec n8n wget -q -O - http://172.18.0.2:3002/health
```

**If connection fails:**
- Check firewall rules (should not be needed for Docker networks)
- Verify port 3002 is not blocked
- Check if containers can ping each other

### 5. Get Container IP Address

```bash
docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}} {{end}}'
```

You can use this IP in n8n if the container name doesn't resolve.

### 6. Test MCP Endpoint

```bash
# Test with a real MCP request
docker exec -it outage-monitor-mcp sh -c '
wget -q -O - --post-data="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}" \
  --header="Content-Type: application/json" \
  http://localhost:3002/mcp
'
```

**Expected**: JSON response with server info

### 7. Check Authentication

```bash
# Check if API key is set
docker exec outage-monitor-mcp printenv STATUSGATOR_API_KEY
```

**If empty**: You MUST provide the API key as a Bearer token in n8n

**If set**: The server will use this as a fallback

### 8. Test with Bearer Token

```bash
# Test with bearer token authentication
docker exec -it outage-monitor-mcp sh -c '
wget -q -O - --post-data="{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}" \
  --header="Content-Type: application/json" \
  --header="Authorization: Bearer YOUR_STATUSGATOR_API_KEY" \
  http://localhost:3002/mcp
'
```

Replace `YOUR_STATUSGATOR_API_KEY` with your actual key.

## Common Issues and Solutions

### Issue 1: "Connection Refused"

**Symptoms:**
- n8n shows "Connection refused" or "ECONNREFUSED"
- Cannot reach http://outage-monitor-mcp:3002

**Solutions:**
1. Check containers are on same network (step 3)
2. Verify MCP server is running (step 1)
3. Check port is 3002 (not 3000)
4. Restart both containers:
   ```bash
   docker-compose restart
   docker restart n8n
   ```

### Issue 2: "Host Not Found" or "DNS Resolution Failed"

**Symptoms:**
- n8n cannot resolve "outage-monitor-mcp"
- Error: "getaddrinfo ENOTFOUND"

**Solutions:**
1. Use IP address instead of hostname:
   ```bash
   # Get IP
   docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}'

   # Use in n8n: http://172.18.0.X:3002/mcp
   ```

2. Check container name is exactly "outage-monitor-mcp":
   ```bash
   docker ps --format '{{.Names}}' | grep monitor
   ```

3. Ensure containers are on same Docker network

### Issue 3: "401 Unauthorized" or "403 Forbidden"

**Symptoms:**
- Connection works but authentication fails
- "No API key provided" error

**Solutions:**
1. Set Bearer token in n8n MCP client:
   - Auth Type: Bearer Token
   - Token: Your StatusGator API key

2. OR set environment variable:
   ```bash
   # Edit .env file
   echo "STATUSGATOR_API_KEY=your_key_here" >> .env

   # Restart
   docker-compose down
   docker-compose up -d
   ```

### Issue 4: "404 Not Found"

**Symptoms:**
- Endpoint not found
- Wrong URL

**Solutions:**
1. Verify URL is: `http://outage-monitor-mcp:3002/mcp`
2. NOT `/message`, NOT `/sse`, NOT `/rpc`
3. Must be POST request
4. Must include JSON-RPC 2.0 payload

### Issue 5: MCP Server Container Keeps Restarting

**Symptoms:**
- Container status shows "Restarting"
- Uptime is very short

**Solutions:**
1. Check logs for errors:
   ```bash
   docker logs outage-monitor-mcp
   ```

2. Common causes:
   - Port 3002 already in use (change PORT in .env)
   - Syntax error in code (check recent changes)
   - Missing dependencies (rebuild: `docker-compose build`)

3. Remove restart policy temporarily to see error:
   ```bash
   docker-compose down
   docker run --rm outage-monitor-mcp
   ```

## n8n MCP Client Configuration

### Recommended Configuration

```
Transport: HTTP
URL: http://outage-monitor-mcp:3002/mcp
Authentication: Bearer Token
Token: YOUR_STATUSGATOR_API_KEY
```

### Alternative: Using HTTP Request Node

If MCP client doesn't work, use HTTP Request node:

```
Method: POST
URL: http://outage-monitor-mcp:3002/mcp
Authentication:
  - Type: Header Auth
  - Name: Authorization
  - Value: Bearer YOUR_STATUSGATOR_API_KEY
Body:
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

## Verify n8n Can See Tools

Once connected, test by calling:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Expected response**: List of 5 tools (check_outage, check_all_outages, etc.)

## Docker Compose Network Setup

If you're using docker-compose for both n8n and MCP server, ensure they share a network:

```yaml
# docker-compose.yml (add to n8n)
version: '3.8'

services:
  n8n:
    # ... your n8n config ...
    networks:
      - mcp-network

networks:
  mcp-network:
    external: true
    name: outage-monitor-mcp_mcp-network  # Or whatever your MCP network is named
```

Or create a shared external network:

```bash
# Create network
docker network create shared-network

# Update both docker-compose.yml files to use it
```

## Getting Help

If you're still stuck, gather this information:

```bash
# 1. Container status
docker ps -a | grep -E "n8n|outage-monitor"

# 2. Network info
docker network ls
docker network inspect <network-name>

# 3. MCP logs
docker logs --tail 50 outage-monitor-mcp

# 4. n8n logs
docker logs --tail 50 n8n

# 5. Server info
curl http://localhost:3002/health
```

Include this output when asking for help.

## Quick Test Commands

```bash
# Test 1: Health check from host
curl http://localhost:3002/health

# Test 2: Health check from n8n container
docker exec n8n wget -q -O - http://outage-monitor-mcp:3002/health

# Test 3: MCP initialize
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# Test 4: List tools with auth
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Still Not Working?

Check these less common issues:

1. **Port conflicts**: Is something else using port 3002?
   ```bash
   lsof -i :3002
   ```

2. **Docker DNS**: Restart Docker daemon
   ```bash
   sudo systemctl restart docker
   ```

3. **Firewall**: Check if Docker networks are blocked
   ```bash
   sudo iptables -L | grep DOCKER
   ```

4. **Container restart policy**: May hide errors
   ```bash
   docker inspect outage-monitor-mcp --format='{{.HostConfig.RestartPolicy}}'
   ```

5. **Resource limits**: Check if container is OOM
   ```bash
   docker stats outage-monitor-mcp
   ```
