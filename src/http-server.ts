#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';

// Get API key from environment variable
const STATUSGATOR_API_KEY = process.env.STATUSGATOR_API_KEY;
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (!STATUSGATOR_API_KEY) {
  console.error('Error: STATUSGATOR_API_KEY environment variable is required');
  console.error('Please set it in your environment or .env file');
  process.exit(1);
}

// TypeScript doesn't know process.exit prevents further execution
const apiKey: string = STATUSGATOR_API_KEY;

// Create Express app
const app = express();

// Enable CORS for all origins (adjust for production)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'outage-monitor-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  console.log('New SSE connection established');

  const transport = new SSEServerTransport('/message', res);
  const server = createServer(apiKey);

  await server.connect(transport);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE connection closed');
  });
});

// Message endpoint for MCP
app.post('/message', async (req, res) => {
  // This endpoint is handled by the SSE transport
  // We just need it to exist
  res.status(200).end();
});

// Root endpoint with API info
app.get('/', (req, res) => {
  res.json({
    name: 'Outage Monitor MCP Server',
    version: '1.0.0',
    description: 'MCP server for monitoring outages on AT&T, Verizon, T-Mobile, AWS, Google Cloud, and Azure',
    endpoints: {
      health: '/health',
      sse: '/sse',
      message: '/message',
    },
    tools: [
      'check_outage',
      'check_all_outages',
      'get_service_status',
      'get_all_incidents',
      'search_service',
    ],
  });
});

// Start the server
app.listen(Number(PORT), HOST, () => {
  console.log(`Outage Monitor MCP Server running on http://${HOST}:${PORT}`);
  console.log(`SSE endpoint: http://${HOST}:${PORT}/sse`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});
