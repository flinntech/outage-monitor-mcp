#!/usr/bin/env node

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createServer } from './server.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Get API key from environment variable (optional - can use bearer token instead)
const STATUSGATOR_API_KEY = process.env.STATUSGATOR_API_KEY;
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// Log startup configuration
if (STATUSGATOR_API_KEY) {
  console.log('StatusGator API key loaded from environment variable');
} else {
  console.log('No environment API key found - will use bearer token from requests');
}

// Create Express app
const app = express();

// Enable CORS for all origins (adjust for production)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  // Check if it's a Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    return match[1];
  }

  return null;
}

/**
 * Get API key from bearer token or environment variable
 */
function getApiKey(req: Request): string {
  // First, try to get bearer token from request
  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    console.log('Using bearer token from Authorization header');
    return bearerToken;
  }

  // Fall back to environment variable
  if (STATUSGATOR_API_KEY) {
    console.log('Using API key from environment variable');
    return STATUSGATOR_API_KEY;
  }

  // No API key available
  throw new Error('No API key provided. Either set STATUSGATOR_API_KEY environment variable or provide Bearer token in Authorization header');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'outage-monitor-mcp',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    auth_methods: [
      'Bearer token (Authorization header)',
      'Environment variable (STATUSGATOR_API_KEY)',
    ],
  });
});

// Streamable HTTP endpoint for MCP
app.post('/mcp', async (req: Request, res: Response) => {
  console.log('MCP request received:', req.body.method);

  try {
    // Set headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const request = req.body;

    // Handle different MCP request types
    if (request.method === 'initialize') {
      // Initialize doesn't require authentication
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
    } else if (request.method === 'notifications/initialized') {
      // Notification acknowledgment - no auth required, no response needed
      res.status(200).end();
    } else if (request.method === 'tools/list') {
      // Tools list doesn't require auth - just returns available tools
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
      // Tool calls require authentication - get API key from bearer token or environment
      const apiKey = getApiKey(req);

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
    authentication: {
      methods: [
        'Bearer token via Authorization header (recommended for n8n)',
        'STATUSGATOR_API_KEY environment variable',
      ],
      priority: 'Bearer token takes precedence over environment variable',
    },
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
  console.log('Authentication: Bearer token (Authorization header) or environment variable');
});
