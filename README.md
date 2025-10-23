# Outage Monitor MCP Server

An MCP (Model Context Protocol) server that monitors service outages for AT&T, Verizon, T-Mobile, AWS, Google Cloud, and Azure using the StatusGator API.

## Features

- Check outages for specific telecom and cloud providers
- Get detailed service status information
- View current incidents across all monitored services
- Search for services in the StatusGator database
- Real-time status monitoring
- **Streamable HTTP transport for n8n and web integrations**
- **Docker support for easy deployment**
- Stdio transport for Claude Desktop

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- OR Node.js 18+ (for local development)
- A StatusGator API key (get one at [statusgator.com](https://statusgator.com))

## Quick Start with Docker

### 1. Clone and Setup

```bash
git clone <repository-url>
cd outage-monitor-mcp
```

### 2. Choose Authentication Method

You have two options for providing the StatusGator API key:

**Option A: Environment Variable (for testing/development)**
```bash
cp .env.example .env
# Edit .env and uncomment/set STATUSGATOR_API_KEY
```

**Option B: Bearer Token (recommended for n8n)**
- Skip the `.env` configuration
- Pass the API key as a Bearer token in the Authorization header with each request
- See [n8n configuration](#using-with-n8n) below

### 3. Run with Docker Compose

```bash
docker-compose up -d
```

The server will be available at `http://localhost:3002`

### 4. Verify It's Running

```bash
curl http://localhost:3002/health
```

You should see:
```json
{
  "status": "ok",
  "server": "outage-monitor-mcp",
  "version": "1.0.0",
  "timestamp": "2025-10-23T14:30:00.000Z"
}
```

## Docker Commands

```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down

# Rebuild after code changes
docker-compose up -d --build

# Run on a different port
PORT=8080 docker-compose up -d
```

## Using with n8n

The MCP server supports **Bearer token authentication**, which is perfect for n8n's MCP client configuration.

### Authentication Setup

The server accepts the StatusGator API key in two ways:

1. **Bearer Token (Recommended for n8n)** - Pass the API key via the `Authorization` header
2. **Environment Variable** - Set `STATUSGATOR_API_KEY` in the server environment

**Priority**: Bearer token takes precedence over environment variable.

### n8n MCP Client Configuration

If n8n has native MCP client support:

1. Add an **MCP Client** node in n8n
2. Configure authentication:
   - **Auth Type**: Bearer Token
   - **Token**: Your StatusGator API key
   - **Transport**: HTTP
   - **URL**: `http://outage-monitor-mcp:3002/mcp` (or `http://localhost:3002/mcp`)

The MCP client will automatically send the bearer token with every request, and the server will use it to authenticate with StatusGator.

### HTTP Request Node (Alternative)

If using a standard HTTP Request node:

1. In n8n, add an **HTTP Request** node
2. Configure the node:
   - **Method**: POST
   - **URL**: `http://outage-monitor-mcp:3002/mcp` (or `http://localhost:3002/mcp` if running locally)
   - **Authentication**: Generic Credential Type
   - **Generic Auth Type**: Header Auth
   - **Name**: Authorization
   - **Value**: `Bearer YOUR_STATUSGATOR_API_KEY`
   - **Body Content Type**: JSON
   - **Body**:
     ```json
     {
       "jsonrpc": "2.0",
       "id": 1,
       "method": "tools/call",
       "params": {
         "name": "check_outage",
         "arguments": {
           "service": "aws"
         }
       }
     }
     ```

The server uses streamable HTTP transport, which means all requests go to a single `/mcp` endpoint using the JSON-RPC 2.0 protocol.

### Example n8n Workflows

#### Check Single Service
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_outage",
    "arguments": {
      "service": "aws"
    }
  }
}
```

#### Check All Services
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "check_all_outages",
    "arguments": {}
  }
}
```

#### Get Service Status
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_service_status",
    "arguments": {
      "service": "azure"
    }
  }
}
```

## API Endpoints

### `GET /`
Server information and available tools

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "server": "outage-monitor-mcp",
  "version": "1.0.0",
  "timestamp": "2025-10-23T14:30:00.000Z"
}
```

### `POST /mcp`
Streamable HTTP endpoint for all MCP requests (JSON-RPC 2.0)

This is the main endpoint for tool calls and MCP protocol communication.

## Available Tools

### 1. `check_outage`

Check if a specific service is experiencing an outage.

**Parameters:**
- `service` (required): Service name (att, verizon, t-mobile, aws, google-cloud, azure)

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_outage",
    "arguments": {
      "service": "aws"
    }
  }
}
```

**Response:**
```json
{
  "service": "Amazon Web Services",
  "hasOutage": false,
  "status": "operational",
  "incidents": []
}
```

### 2. `check_all_outages`

Check all monitored services for outages.

**Parameters:** None

**Response:**
```json
{
  "total_services": 6,
  "services_with_outages": 1,
  "outages": [
    {
      "service": "AT&T",
      "hasOutage": true,
      "status": "degraded",
      "incidents": [...]
    }
  ],
  "all_statuses": [...]
}
```

### 3. `get_service_status`

Get detailed status information for a specific service.

**Parameters:**
- `service` (required): Service name

**Example:**
```json
{
  "service": "azure"
}
```

**Response:**
```json
{
  "service_id": "microsoft-azure",
  "service_name": "Microsoft Azure",
  "status": "operational",
  "current_incidents": [],
  "last_checked": "2025-10-23T14:30:00.000Z"
}
```

### 4. `get_all_incidents`

Get all current incidents across all monitored services.

**Parameters:** None

**Response:**
```json
{
  "total_incidents": 2,
  "incidents": [
    {
      "id": "incident-123",
      "service_name": "Verizon",
      "title": "Network connectivity issues",
      "description": "Some users may experience...",
      "status": "investigating",
      "severity": "major",
      "created_at": "2025-10-23T13:00:00.000Z",
      "updated_at": "2025-10-23T14:00:00.000Z"
    }
  ]
}
```

### 5. `search_service`

Search for a service by name in the StatusGator database.

**Parameters:**
- `service_name` (required): Name of the service to search for

**Example:**
```json
{
  "service_name": "cloudflare"
}
```

### 6. `get_historical_incidents`

Get historical incidents for a service within a specific date range. Perfect for analyzing past outages and incident patterns.

**Parameters:**
- `service` (required): Service name
- `start_date` (optional): Start date in ISO format (e.g., "2025-01-01T00:00:00Z")
- `end_date` (optional): End date in ISO format (e.g., "2025-01-31T23:59:59Z")
- `status` (optional): Filter by status (e.g., "resolved", "investigating")

**Example:**
```json
{
  "service": "aws",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "service": "aws",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z",
  "total_incidents": 3,
  "incidents": [
    {
      "id": "incident-456",
      "service_name": "Amazon Web Services",
      "title": "EC2 connectivity issues",
      "created_at": "2025-01-15T10:30:00Z",
      "resolved_at": "2025-01-15T12:45:00Z",
      "status": "resolved"
    }
  ]
}
```

### 7. `get_service_uptime`

Calculate uptime statistics for a service over a specific period. Returns uptime percentage and total downtime.

**Parameters:**
- `service` (required): Service name
- `start_date` (required): Start date in ISO format
- `end_date` (required): End date in ISO format

**Example:**
```json
{
  "service": "verizon",
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "service_id": "verizon",
  "service_name": "Verizon",
  "period_start": "2025-01-01T00:00:00Z",
  "period_end": "2025-01-31T23:59:59Z",
  "total_incidents": 2,
  "total_downtime_minutes": 180,
  "uptime_percentage": 99.75,
  "incidents": [...]
}
```

### 8. `get_multi_service_history`

Get incident history for multiple services at once. Useful for comparing outages across carriers or cloud providers.

**Parameters:**
- `services` (required): Array of service names
- `start_date` (optional): Start date in ISO format
- `end_date` (optional): End date in ISO format

**Example:**
```json
{
  "services": ["att", "verizon", "t-mobile"],
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "services": ["att", "verizon", "t-mobile"],
  "start_date": "2025-01-01T00:00:00Z",
  "end_date": "2025-01-31T23:59:59Z",
  "total_incidents": 5,
  "history": {
    "att": [...incidents...],
    "verizon": [...incidents...],
    "t-mobile": [...incidents...]
  }
}
```

## Supported Services

The server monitors these services:

- **AT&T** (`att`)
- **Verizon** (`verizon`)
- **T-Mobile** (`t-mobile` or `tmobile`)
- **Amazon Web Services** (`aws` or `amazon-web-services`)
- **Google Cloud** (`google-cloud` or `gcp`)
- **Microsoft Azure** (`azure` or `microsoft-azure`)

## Local Development (Without Docker)

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd outage-monitor-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp .env.example .env
```

4. Edit `.env` and add your API key:
```
STATUSGATOR_API_KEY=your_actual_api_key_here
```

5. Build the project:
```bash
npm run build
```

### Running Locally

**HTTP Mode (for n8n):**
```bash
npm start
# or
MCP_TRANSPORT=http npm start
```

**Stdio Mode (for Claude Desktop):**
```bash
MCP_TRANSPORT=stdio npm start:stdio
```

### Development Mode
```bash
npm run watch
```

## Claude Desktop Configuration

To use this server with Claude Desktop (stdio mode), add it to your MCP settings configuration:

**For macOS** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "outage-monitor": {
      "command": "node",
      "args": ["/absolute/path/to/outage-monitor-mcp/dist/stdio.js"],
      "env": {
        "STATUSGATOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**For Windows** (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "outage-monitor": {
      "command": "node",
      "args": ["C:\\path\\to\\outage-monitor-mcp\\dist\\stdio.js"],
      "env": {
        "STATUSGATOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Authentication

The MCP server supports two authentication methods:

### 1. Bearer Token (Recommended for n8n)

Pass your StatusGator API key in the `Authorization` header:

```
Authorization: Bearer YOUR_STATUSGATOR_API_KEY
```

This is the recommended approach for n8n as it keeps credentials secure and allows dynamic configuration per workflow.

**Example with curl:**
```bash
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STATUSGATOR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 2. Environment Variable

Set the `STATUSGATOR_API_KEY` environment variable:

```bash
export STATUSGATOR_API_KEY=your_api_key_here
```

Or in your `.env` file:
```
STATUSGATOR_API_KEY=your_api_key_here
```

This is useful for testing, development, or when the server is dedicated to a single API key.

### Authentication Priority

If both methods are provided:
1. Bearer token from Authorization header (takes precedence)
2. Environment variable `STATUSGATOR_API_KEY` (fallback)

If neither is provided, requests will fail with an authentication error.

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `STATUSGATOR_API_KEY` | Your StatusGator API key | - | No* |
| `PORT` | HTTP server port | `3002` | No |
| `HOST` | HTTP server host | `0.0.0.0` | No |
| `MCP_TRANSPORT` | Transport mode (`http` or `stdio`) | `http` | No |
| `NODE_ENV` | Node environment | `production` | No |

\* Not required if using Bearer token authentication

## Getting Your StatusGator API Key

1. Sign up for a StatusGator account at [statusgator.com](https://statusgator.com)
2. Go to Settings (click the 3 dots next to your board name)
3. Select the API menu tab
4. Copy your API token
5. Add it to your `.env` file

## Architecture

```
outage-monitor-mcp/
├── src/
│   ├── index.ts          # Main entry point (transport router)
│   ├── server.ts         # Shared MCP server logic
│   ├── stdio.ts          # Stdio transport (Claude Desktop)
│   ├── http-server.ts    # Streamable HTTP transport (n8n, web)
│   └── statusgator.ts    # StatusGator API client
├── dist/                 # Compiled JavaScript (generated)
├── Dockerfile            # Docker image definition
├── docker-compose.yml    # Docker Compose configuration
├── package.json
├── tsconfig.json
├── .env.example
├── troubleshoot.sh       # Automated troubleshooting script
├── TROUBLESHOOTING.md    # Detailed troubleshooting guide
└── README.md
```

## Development

### Building

```bash
npm run build
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the server (HTTP mode by default)
- `npm run start:stdio` - Run with stdio transport
- `npm run start:http` - Run with HTTP transport
- `npm run dev` - Build and run
- `npm run watch` - Watch mode for development

## Troubleshooting

### Quick Diagnosis

If you're having trouble connecting n8n to the MCP server, run the automated troubleshooting script:

```bash
./troubleshoot.sh
```

This will check:
- Container status and health
- Network connectivity between n8n and MCP server
- Port configuration
- Authentication setup
- Endpoint accessibility

**For detailed troubleshooting steps**, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Common Issues

#### n8n Cannot Connect to MCP Server

**Quick checks:**

1. Verify both containers are on the same Docker network:
   ```bash
   # Check MCP server networks
   docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'

   # Check n8n networks
   docker inspect n8n --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
   ```

2. Test connectivity from n8n to MCP server:
   ```bash
   docker exec n8n wget -q -O - http://outage-monitor-mcp:3002/health
   ```

3. If container name doesn't resolve, use IP address:
   ```bash
   # Get MCP server IP
   docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$v.IPAddress}}{{end}}'

   # Use in n8n: http://172.x.x.x:3002/mcp
   ```

4. Verify n8n has the correct URL:
   - ✓ Correct: `http://outage-monitor-mcp:3002/mcp`
   - ✗ Wrong: `http://outage-monitor-mcp:3000/mcp` (old port)
   - ✗ Wrong: `http://outage-monitor-mcp:3002/message` (old endpoint)

5. Check bearer token is set in n8n MCP client

**See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for complete guide**

### Docker Container Won't Start

1. Check logs:
   ```bash
   docker-compose logs
   ```

2. Verify API key is set:
   ```bash
   docker-compose exec outage-monitor env | grep STATUSGATOR
   ```

3. Check if port 3002 is already in use:
   ```bash
   lsof -i :3002
   ```

### Authentication Errors

If you get "No API key provided" or 401/403 errors:

1. **Using n8n MCP Client**: Set bearer token:
   - Auth Type: Bearer Token
   - Token: Your StatusGator API key

2. **Using HTTP Request node**: Add Authorization header:
   - Name: Authorization
   - Value: `Bearer YOUR_STATUSGATOR_API_KEY`

3. **Alternative**: Set environment variable in `.env`:
   ```bash
   STATUSGATOR_API_KEY=your_key_here
   docker-compose restart
   ```

### API Rate Limiting

StatusGator has API rate limits. If you exceed them:
- The API will return 429 status codes
- Implement exponential backoff
- Consider caching results

## Security Considerations

- Never commit your `.env` file
- Use environment variables for sensitive data
- In production, restrict CORS origins in `http-server.ts`
- Consider adding authentication for the HTTP endpoints
- Run the container as a non-root user (already configured)

## API Reference

This server uses the [StatusGator API v3](https://statusgator.com/api/v3/docs). The API provides:

- Real-time status data from over 3,500 services
- Historical incident data
- Service status information
- Incident details and timelines

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues related to:
- This MCP server: Open an issue in this repository
- StatusGator API: Contact [StatusGator support](https://support.statusgator.com)
- MCP protocol: See [Model Context Protocol documentation](https://modelcontextprotocol.io)
- n8n integration: See [n8n documentation](https://docs.n8n.io)

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [StatusGator API](https://statusgator.com)
- Docker containerization for easy deployment
- Streamable HTTP transport for n8n integration
