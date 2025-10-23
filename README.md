# Outage Monitor MCP Server

An MCP (Model Context Protocol) server that monitors service outages for AT&T, Verizon, T-Mobile, AWS, Google Cloud, and Azure using the StatusGator API.

## Features

- Check outages for specific telecom and cloud providers
- Get detailed service status information
- View current incidents across all monitored services
- Search for services in the StatusGator database
- Real-time status monitoring

## Prerequisites

- Node.js 18 or higher
- A StatusGator API key (get one at [statusgator.com](https://statusgator.com))

## Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd outage-monitor-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your StatusGator API key:
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

## Getting Your StatusGator API Key

1. Sign up for a StatusGator account at [statusgator.com](https://statusgator.com)
2. Go to Settings (click the 3 dots next to your board name)
3. Select the API menu tab
4. Copy your API token
5. Add it to your `.env` file

## Usage

### Running the Server

```bash
npm start
```

For development with auto-rebuild:
```bash
npm run watch
```

### MCP Configuration

To use this server with Claude Desktop or other MCP clients, add it to your MCP settings configuration:

**For Claude Desktop on macOS** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "outage-monitor": {
      "command": "node",
      "args": ["/absolute/path/to/outage-monitor-mcp/dist/index.js"],
      "env": {
        "STATUSGATOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**For Claude Desktop on Windows** (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "outage-monitor": {
      "command": "node",
      "args": ["C:\\path\\to\\outage-monitor-mcp\\dist\\index.js"],
      "env": {
        "STATUSGATOR_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### 1. `check_outage`

Check if a specific service is experiencing an outage.

**Parameters:**
- `service` (required): Service name (att, verizon, t-mobile, aws, google-cloud, azure)

**Example:**
```json
{
  "service": "aws"
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

## Supported Services

The server monitors these services:

- **AT&T** (`att`)
- **Verizon** (`verizon`)
- **T-Mobile** (`t-mobile` or `tmobile`)
- **Amazon Web Services** (`aws` or `amazon-web-services`)
- **Google Cloud** (`google-cloud` or `gcp`)
- **Microsoft Azure** (`azure` or `microsoft-azure`)

## Development

### Project Structure

```
outage-monitor-mcp/
├── src/
│   ├── index.ts          # Main MCP server implementation
│   └── statusgator.ts    # StatusGator API client
├── dist/                 # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Building

```bash
npm run build
```

### Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled server
- `npm run dev` - Build and run
- `npm run watch` - Watch mode for development

## API Reference

This server uses the [StatusGator API v3](https://statusgator.com/api/v3/docs). The API provides:

- Real-time status data from over 3,500 services
- Historical incident data
- Service status information
- Incident details and timelines

## Error Handling

The server handles various error scenarios:

- Missing or invalid API key
- Service not found
- API rate limiting
- Network errors
- Invalid parameters

All errors are returned in a structured format:

```json
{
  "error": "Error message here"
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues related to:
- This MCP server: Open an issue in this repository
- StatusGator API: Contact [StatusGator support](https://support.statusgator.com)
- MCP protocol: See [Model Context Protocol documentation](https://modelcontextprotocol.io)

## Acknowledgments

- Built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [StatusGator API](https://statusgator.com)
