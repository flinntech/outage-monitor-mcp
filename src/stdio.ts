#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

// Get API key from environment variable
const STATUSGATOR_API_KEY = process.env.STATUSGATOR_API_KEY;

if (!STATUSGATOR_API_KEY) {
  console.error('Error: STATUSGATOR_API_KEY environment variable is required');
  console.error('Please set it in your environment or .env file');
  process.exit(1);
}

// TypeScript doesn't know process.exit prevents further execution
const apiKey: string = STATUSGATOR_API_KEY;

// Create and start the server with stdio transport
async function main() {
  const server = createServer(apiKey);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Outage Monitor MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
