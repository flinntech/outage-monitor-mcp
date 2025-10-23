#!/bin/bash

# Troubleshooting script for MCP Server connectivity
# Run this script to diagnose connectivity issues between n8n and MCP server

echo "========================================="
echo "MCP Server Troubleshooting Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if MCP server container is running
echo "1. Checking if MCP server container is running..."
if docker ps | grep -q "outage-monitor-mcp"; then
    echo -e "${GREEN}✓ MCP server container is running${NC}"
    CONTAINER_ID=$(docker ps -q -f name=outage-monitor-mcp)
    echo "  Container ID: $CONTAINER_ID"
else
    echo -e "${RED}✗ MCP server container is NOT running${NC}"
    echo "  Run: docker-compose up -d"
    exit 1
fi
echo ""

# Step 2: Check container health
echo "2. Checking container health..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' outage-monitor-mcp 2>/dev/null)
if [ "$HEALTH" == "healthy" ]; then
    echo -e "${GREEN}✓ Container is healthy${NC}"
elif [ "$HEALTH" == "unhealthy" ]; then
    echo -e "${RED}✗ Container is unhealthy${NC}"
    echo "  Check logs: docker logs outage-monitor-mcp"
elif [ -z "$HEALTH" ]; then
    echo -e "${YELLOW}⚠ Health check not configured or still starting${NC}"
else
    echo -e "${YELLOW}⚠ Container health: $HEALTH${NC}"
fi
echo ""

# Step 3: Check container logs for errors
echo "3. Checking recent container logs..."
echo "  Last 10 lines:"
docker logs --tail 10 outage-monitor-mcp 2>&1 | sed 's/^/    /'
echo ""

# Step 4: Check which port the server is listening on
echo "4. Checking server port configuration..."
PORT=$(docker inspect outage-monitor-mcp --format='{{range .Config.Env}}{{println .}}{{end}}' | grep '^PORT=' | cut -d'=' -f2)
if [ -z "$PORT" ]; then
    PORT="3002"
fi
echo "  Server is configured to listen on port: $PORT"
echo ""

# Step 5: Check Docker networks
echo "5. Checking Docker networks..."
NETWORKS=$(docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}')
echo "  MCP server is on network(s): $NETWORKS"
echo ""

# Step 6: Check if n8n container exists and its network
echo "6. Checking n8n container..."
if docker ps | grep -q "n8n"; then
    echo -e "${GREEN}✓ n8n container found${NC}"
    N8N_NETWORKS=$(docker ps --filter name=n8n --format '{{.Names}}' | xargs -I {} docker inspect {} --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}')
    echo "  n8n is on network(s): $N8N_NETWORKS"

    # Check if they share a network
    SHARED_NETWORK=""
    for net in $NETWORKS; do
        if echo "$N8N_NETWORKS" | grep -q "$net"; then
            SHARED_NETWORK="$net"
            echo -e "${GREEN}✓ Both containers share network: $SHARED_NETWORK${NC}"
        fi
    done

    if [ -z "$SHARED_NETWORK" ]; then
        echo -e "${RED}✗ Containers are NOT on the same network!${NC}"
        echo "  MCP networks: $NETWORKS"
        echo "  n8n networks: $N8N_NETWORKS"
        echo ""
        echo "  Fix: Add n8n to the MCP network or vice versa"
    fi
else
    echo -e "${YELLOW}⚠ n8n container not found (or named differently)${NC}"
    echo "  Available containers:"
    docker ps --format "  - {{.Names}}" | grep -v outage-monitor-mcp
fi
echo ""

# Step 7: Test internal connectivity (from MCP container)
echo "7. Testing internal server connectivity..."
if docker exec outage-monitor-mcp wget -q -O - http://localhost:$PORT/health 2>/dev/null; then
    echo -e "${GREEN}✓ Server responds to internal health check${NC}"
else
    echo -e "${RED}✗ Server does NOT respond to internal health check${NC}"
    echo "  The server may not be running correctly"
fi
echo ""

# Step 8: Get the container's IP address
echo "8. Getting container IP address..."
IP=$(docker inspect outage-monitor-mcp --format='{{range $k, $v := .NetworkSettings.Networks}}{{$v.IPAddress}} {{end}}' | awk '{print $1}')
echo "  MCP server IP: $IP"
echo ""

# Step 9: Test from n8n container (if found)
echo "9. Testing connectivity from n8n to MCP server..."
N8N_CONTAINER=$(docker ps --filter name=n8n --format '{{.Names}}' | head -1)
if [ ! -z "$N8N_CONTAINER" ]; then
    echo "  Testing from $N8N_CONTAINER..."

    # Test by container name
    echo "  - Testing: http://outage-monitor-mcp:$PORT/health"
    if docker exec $N8N_CONTAINER wget -q -O - http://outage-monitor-mcp:$PORT/health 2>/dev/null | grep -q "ok"; then
        echo -e "    ${GREEN}✓ SUCCESS - n8n can reach MCP server by name${NC}"
    else
        echo -e "    ${RED}✗ FAILED - n8n cannot reach MCP server by name${NC}"
    fi

    # Test by IP
    if [ ! -z "$IP" ]; then
        echo "  - Testing: http://$IP:$PORT/health"
        if docker exec $N8N_CONTAINER wget -q -O - http://$IP:$PORT/health 2>/dev/null | grep -q "ok"; then
            echo -e "    ${GREEN}✓ SUCCESS - n8n can reach MCP server by IP${NC}"
        else
            echo -e "    ${RED}✗ FAILED - n8n cannot reach MCP server by IP${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Skipping - n8n container not found${NC}"
fi
echo ""

# Step 10: Check MCP endpoint
echo "10. Testing MCP endpoint..."
RESPONSE=$(docker exec outage-monitor-mcp wget -q -O - http://localhost:$PORT/mcp 2>&1)
if echo "$RESPONSE" | grep -q "jsonrpc"; then
    echo -e "${GREEN}✓ /mcp endpoint responds (as expected)${NC}"
else
    echo -e "${YELLOW}⚠ /mcp endpoint needs POST request with JSON-RPC payload${NC}"
fi
echo ""

# Step 11: Check authentication
echo "11. Checking authentication configuration..."
HAS_ENV_KEY=$(docker exec outage-monitor-mcp printenv STATUSGATOR_API_KEY 2>/dev/null)
if [ ! -z "$HAS_ENV_KEY" ] && [ "$HAS_ENV_KEY" != "" ]; then
    echo -e "${GREEN}✓ STATUSGATOR_API_KEY environment variable is set${NC}"
    echo "  (Key length: ${#HAS_ENV_KEY} characters)"
else
    echo -e "${YELLOW}⚠ STATUSGATOR_API_KEY environment variable is NOT set${NC}"
    echo "  You MUST provide API key via Bearer token in n8n"
fi
echo ""

# Step 12: Show server info endpoint
echo "12. Fetching server info..."
docker exec outage-monitor-mcp wget -q -O - http://localhost:$PORT/ 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  (Could not parse JSON response)"
echo ""

# Summary and recommendations
echo "========================================="
echo "SUMMARY & RECOMMENDATIONS"
echo "========================================="
echo ""
echo "For n8n MCP Client configuration, use:"
echo "  URL: http://outage-monitor-mcp:$PORT/mcp"
echo "  OR"
echo "  URL: http://$IP:$PORT/mcp"
echo ""
echo "Authentication:"
if [ ! -z "$HAS_ENV_KEY" ] && [ "$HAS_ENV_KEY" != "" ]; then
    echo "  - Environment variable is set (can work without bearer token)"
    echo "  - OR use Bearer token in n8n for better security"
else
    echo "  - REQUIRED: Set Bearer token in n8n MCP client"
    echo "  - Token = Your StatusGator API key"
fi
echo ""
echo "To view live logs:"
echo "  docker logs -f outage-monitor-mcp"
echo ""
echo "To restart the server:"
echo "  docker-compose restart"
echo ""
