import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StatusGatorClient } from './statusgator.js';

// Define the tools
export const TOOLS: Tool[] = [
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

export function createServer(apiKey: string): Server {
  // Initialize the StatusGator client
  const statusGatorClient = new StatusGatorClient(apiKey);

  // Create the MCP server
  const server = new Server(
    {
      name: 'outage-monitor-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list_tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Handle call_tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'check_outage': {
          const service = args?.service as string;
          if (!service) {
            throw new Error('Service parameter is required');
          }

          const result = await statusGatorClient.checkOutage(service);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'check_all_outages': {
          const services = ['att', 'verizon', 't-mobile', 'aws', 'google-cloud', 'azure'];
          const results = await Promise.all(
            services.map(service => statusGatorClient.checkOutage(service))
          );

          const outages = results.filter(r => r.hasOutage);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  total_services: services.length,
                  services_with_outages: outages.length,
                  outages,
                  all_statuses: results,
                }, null, 2),
              },
            ],
          };
        }

        case 'get_service_status': {
          const service = args?.service as string;
          if (!service) {
            throw new Error('Service parameter is required');
          }

          const status = await statusGatorClient.getServiceStatus(service);

          if (!status) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: `Service '${service}' not found`,
                  }, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(status, null, 2),
              },
            ],
          };
        }

        case 'get_all_incidents': {
          const incidents = await statusGatorClient.getAllCurrentIncidents();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  total_incidents: incidents.length,
                  incidents,
                }, null, 2),
              },
            ],
          };
        }

        case 'search_service': {
          const serviceName = args?.service_name as string;
          if (!serviceName) {
            throw new Error('service_name parameter is required');
          }

          const service = await statusGatorClient.searchService(serviceName);

          if (!service) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: `Service '${serviceName}' not found`,
                  }, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(service, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
