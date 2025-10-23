#!/usr/bin/env node

/**
 * Main entry point for the Outage Monitor MCP Server
 * Supports both stdio and HTTP (SSE) transports
 *
 * Usage:
 *   - Default (HTTP): node dist/index.js
 *   - Stdio mode: MCP_TRANSPORT=stdio node dist/index.js
 *   - HTTP mode: MCP_TRANSPORT=http node dist/index.js
 */

const transport = process.env.MCP_TRANSPORT || 'http';

if (transport === 'stdio') {
  // Use stdio transport (for Claude Desktop, etc.)
  import('./stdio.js');
} else if (transport === 'http') {
  // Use HTTP/SSE transport (for n8n, web clients, etc.)
  import('./http-server.js');
} else {
  console.error(`Unknown transport: ${transport}`);
  console.error('Valid options: stdio, http');
  process.exit(1);
}
