import dotenv from 'dotenv';

// Create a wrapper for McpServer to handle the dynamic import
class McpServerWrapper {
  private _server: any;

  constructor(options: any) {
    // Import dynamically to avoid TypeScript error
    const sdk = require('@modelcontextprotocol/sdk/server/mcp.js');
    this._server = new sdk.McpServer(options);
  }

  registerTool(name: string, options: any, handler: any): void {
    this._server.registerTool(name, options, handler);
  }

  async connect(transport: any): Promise<void> {
    return this._server.connect(transport);
  }
}

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { tokenTools } from './tools/tokens';
import { nftTools } from './tools/nfts';
import { registerDefiTools } from './tools/defi';
import { registerGeneralTools } from './tools/general';
import { registerContractTools } from './tools/contracts';

// Load environment variables
dotenv.config();

const NETWORK = process.env.ETHEREUM_NETWORK || 'mainnet';

// Create and configure the MCP server
const server = new McpServerWrapper({
  name: 'PortalMCP',
  version: '1.0.0',
  description: 'PortalMCP - Claude Integration Layer for Ethereum interactions',
});

// Register general tools directly
registerGeneralTools(server);

// Register contract tools directly
registerContractTools(server);

// Register defi tools directly
registerDefiTools(server);

// Combine other tools
const otherTools = [...tokenTools, ...nftTools];

// Register other tools individually
otherTools.forEach(tool => {
  server.registerTool(tool.name, {
    description: tool.description,
    inputSchema: tool.parameters
  }, tool.handler);
});

// Create stdio transport and start the server
async function main() {
  // Use stderr for logging so it doesn't interfere with JSON-RPC on stdout
  console.error(`PortalMCP server starting...`);
  console.error(`Connected to Ethereum network: ${NETWORK}`);
  
  // Create stdio transport
  const transport = new StdioServerTransport();
  
  // Connect the MCP server to the transport
  await server.connect(transport);
  
  console.error('PortalMCP server ready');
}

main().catch(err => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
