import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPortalServer } from './server-factory';

const NETWORK = process.env.ETHEREUM_NETWORK || 'mainnet';

async function main() {
  // stderr only — stdout is reserved for JSON-RPC
  console.error(`PortalMCP (stdio) starting on network: ${NETWORK}`);
  const server = createPortalServer({ network: NETWORK });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PortalMCP server ready');
}

main().catch(err => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
