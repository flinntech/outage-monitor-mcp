#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from './server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Get API key from environment variable
const STATUSGATOR_API_KEY = process.env.STATUSGATOR_API_KEY;
const PORT = process.env.PORT || 3002;
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

// Create a single MCP server instance
const mcpServer: Server = createServer(apiKey);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'outage-monitor-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Streamable HTTP endpoint for MCP
app.post('/mcp', async (req: Request, res: Response) => {
  console.log('MCP request received:', req.body);

  try {
    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const request = req.body;

    // Handle different MCP request types
    if (request.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'outage-monitor-mcp',
            version: '1.0.0',
          },
        },
      };
      res.json(response);
    } else if (request.method === 'tools/list') {
      // Get the tools from the server
      const tools = [
        {
          name: 'check_outage',
          description: 'Check if a specific service is experiencing an outage. Supports: AT&T, Verizon, T-Mobile, AWS, Google Cloud, Azure',
          inputSchema: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                description: 'The service to check (e.g., "att", "verizon", "t-mobile", "aws", "google-cloud", "azure")',
                enum: ['att', 'verizon', 't-mobile', 'tmobile', 'aws', 'google-cloud', 'gcp', 'azure'],
              },
            },
            required: ['service'],
          },
        },
        {
          name: 'check_all_outages',
          description: 'Check all monitored services (AT&T, Verizon, T-Mobile, AWS, Google Cloud, Azure) for outages',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_service_status',
          description: 'Get detailed status information for a specific service including current incidents',
          inputSchema: {
            type: 'object',
            properties: {
              service: {
                type: 'string',
                description: 'The service to get status for (e.g., "att", "verizon", "t-mobile", "aws", "google-cloud", "azure")',
              },
            },
            required: ['service'],
          },
        },
        {
          name: 'get_all_incidents',
          description: 'Get all current incidents across all monitored services',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'search_service',
          description: 'Search for a service by name in the StatusGator database',
          inputSchema: {
            type: 'object',
            properties: {
              service_name: {
                type: 'string',
                description: 'The name of the service to search for',
              },
            },
            required: ['service_name'],
          },
        },
      ];

      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: tools,
        },
      };
      res.json(response);
    } else if (request.method === 'tools/call') {
      // Forward the tool call to the MCP server's handler
      // We'll call the tools directly here since we can't easily extract the handler
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      // Import the StatusGator client to call tools directly
      const { StatusGatorClient } = await import('./statusgator.js');
      const statusGatorClient = new StatusGatorClient(apiKey);

      let result;

      switch (toolName) {
        case 'check_outage': {
          const service = toolArgs?.service;
          if (!service) {
            throw new Error('Service parameter is required');
          }
          result = await statusGatorClient.checkOutage(service);
          break;
        }

        case 'check_all_outages': {
          const services = ['att', 'verizon', 't-mobile', 'aws', 'google-cloud', 'azure'];
          const results = await Promise.all(
            services.map(service => statusGatorClient.checkOutage(service))
          );
          const outages = results.filter(r => r.hasOutage);
          result = {
            total_services: services.length,
            services_with_outages: outages.length,
            outages,
            all_statuses: results,
          };
          break;
        }

        case 'get_service_status': {
          const service = toolArgs?.service;
          if (!service) {
            throw new Error('Service parameter is required');
          }
          const status = await statusGatorClient.getServiceStatus(service);
          if (!status) {
            result = { error: `Service '${service}' not found` };
          } else {
            result = status;
          }
          break;
        }

        case 'get_all_incidents': {
          const incidents = await statusGatorClient.getAllCurrentIncidents();
          result = {
            total_incidents: incidents.length,
            incidents,
          };
          break;
        }

        case 'search_service': {
          const serviceName = toolArgs?.service_name;
          if (!serviceName) {
            throw new Error('service_name parameter is required');
          }
          const service = await statusGatorClient.searchService(serviceName);
          if (!service) {
            result = { error: `Service '${serviceName}' not found` };
          } else {
            result = service;
          }
          break;
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
      res.json(response);
    } else {
      // Unknown method
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    const response = {
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
    res.status(500).json(response);
  }
});

// Root endpoint with API info
app.get('/', (req, res) => {
  res.json({
    name: 'Outage Monitor MCP Server',
    version: '1.0.0',
    description: 'MCP server for monitoring outages on AT&T, Verizon, T-Mobile, AWS, Google Cloud, and Azure',
    transport: 'HTTP (Streamable)',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)',
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
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
});
