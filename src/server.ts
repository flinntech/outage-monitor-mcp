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
  {
    name: 'get_historical_incidents',
    description: 'Get historical incidents for a service within a date range. Returns past outages and incidents.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'The service to get history for (e.g., "aws", "azure", "verizon")',
        },
        start_date: {
          type: 'string',
          description: 'Start date in ISO format (e.g., "2025-01-01T00:00:00Z"). Optional.',
        },
        end_date: {
          type: 'string',
          description: 'End date in ISO format (e.g., "2025-01-31T23:59:59Z"). Optional.',
        },
        status: {
          type: 'string',
          description: 'Filter by incident status (e.g., "resolved", "investigating"). Optional.',
        },
      },
      required: ['service'],
    },
  },
  {
    name: 'get_service_uptime',
    description: 'Calculate uptime statistics for a service over a specific period. Returns uptime percentage and total downtime.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'The service to analyze (e.g., "aws", "google-cloud", "att")',
        },
        start_date: {
          type: 'string',
          description: 'Start date in ISO format (e.g., "2025-01-01T00:00:00Z")',
        },
        end_date: {
          type: 'string',
          description: 'End date in ISO format (e.g., "2025-01-31T23:59:59Z")',
        },
      },
      required: ['service', 'start_date', 'end_date'],
    },
  },
  {
    name: 'get_multi_service_history',
    description: 'Get incident history for multiple services at once. Useful for comparing outages across carriers or cloud providers.',
    inputSchema: {
      type: 'object',
      properties: {
        services: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Array of service names (e.g., ["att", "verizon", "t-mobile"])',
        },
        start_date: {
          type: 'string',
          description: 'Start date in ISO format. Optional.',
        },
        end_date: {
          type: 'string',
          description: 'End date in ISO format. Optional.',
        },
      },
      required: ['services'],
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

        case 'get_historical_incidents': {
          const service = args?.service as string;
          if (!service) {
            throw new Error('Service parameter is required');
          }

          const startDate = args?.start_date as string | undefined;
          const endDate = args?.end_date as string | undefined;
          const status = args?.status as string | undefined;

          const incidents = await statusGatorClient.getHistoricalIncidents(
            service,
            startDate,
            endDate,
            status
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  service,
                  total_incidents: incidents.length,
                  start_date: startDate || 'not specified',
                  end_date: endDate || 'not specified',
                  status_filter: status || 'all',
                  incidents,
                }, null, 2),
              },
            ],
          };
        }

        case 'get_service_uptime': {
          const service = args?.service as string;
          const startDate = args?.start_date as string;
          const endDate = args?.end_date as string;

          if (!service) {
            throw new Error('Service parameter is required');
          }
          if (!startDate) {
            throw new Error('start_date parameter is required');
          }
          if (!endDate) {
            throw new Error('end_date parameter is required');
          }

          const uptime = await statusGatorClient.getServiceUptime(
            service,
            startDate,
            endDate
          );

          if (!uptime) {
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
                text: JSON.stringify(uptime, null, 2),
              },
            ],
          };
        }

        case 'get_multi_service_history': {
          const services = args?.services as string[];
          if (!services || !Array.isArray(services) || services.length === 0) {
            throw new Error('services parameter is required and must be a non-empty array');
          }

          const startDate = args?.start_date as string | undefined;
          const endDate = args?.end_date as string | undefined;

          const history = await statusGatorClient.getMultiServiceHistory(
            services,
            startDate,
            endDate
          );

          let totalIncidents = 0;
          for (const incidents of Object.values(history)) {
            totalIncidents += incidents.length;
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  services,
                  total_incidents: totalIncidents,
                  start_date: startDate || 'not specified',
                  end_date: endDate || 'not specified',
                  history,
                }, null, 2),
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
