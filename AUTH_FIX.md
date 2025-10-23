# Authentication Fix for n8n MCP Client

## Problem Identified

Your logs showed:
```
MCP request received: initialize
Error handling MCP request: Error: No API key provided
```

The MCP client (n8n) was making `initialize` and `notifications/initialized` requests **without** a Bearer token. This is actually **correct behavior** - these are handshake/discovery methods that shouldn't require authentication.

## What I Fixed

Changed authentication to be **method-specific**:

### Methods that DON'T require authentication:
- `initialize` - Server capability discovery
- `notifications/initialized` - Handshake acknowledgment
- `tools/list` - List available tools (discovery)

### Methods that DO require authentication:
- `tools/call` - Execute actual tool calls (needs API key)

## Why This Is Correct

According to MCP protocol:
1. Client connects and calls `initialize` (no auth)
2. Server responds with capabilities
3. Client sends `notifications/initialized` (no auth)
4. Client calls `tools/list` to discover tools (no auth)
5. Client calls `tools/call` to execute (REQUIRES auth)

Only the actual tool execution needs credentials because that's when we call the StatusGator API.

## How to Apply

```bash
cd /docker/outage-monitor-mcp
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## What You'll See

After rebuild, your logs should show:
```
MCP request received: initialize
(no auth error - success!)
MCP request received: notifications/initialized
(no auth error - success!)
MCP request received: tools/list
(no auth error - success!)
MCP request received: tools/call
Using bearer token from Authorization header
(tool executes successfully!)
```

## Testing in n8n

Your n8n MCP client should now:
1. ✓ Connect successfully
2. ✓ Discover the 5 available tools
3. ✓ Execute tools using your bearer token

Bearer token is only used when actually calling tools, not during the handshake.

This is the standard MCP pattern and matches how other MCP servers work!
