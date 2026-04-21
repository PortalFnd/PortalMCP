/**
 * PortalMCP over Streamable HTTP (MCP 2025-03-26 transport spec).
 *
 * Exposes the full PortalMCP server (tools, resources, prompts) at POST/GET /mcp
 * so remote clients — hosted Claude, ChatGPT MCP connectors, Gemini, custom
 * agents — can connect without needing stdio.
 *
 * Run: `npm run dev:http` or `npm run start:http` (after `npm run build`).
 * Endpoint: http://<host>:<port>/mcp
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createPortalServer } from './server-factory';

const {
  StreamableHTTPServerTransport
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  isInitializeRequest
} = require('@modelcontextprotocol/sdk/types.js');

const PORT = parseInt(process.env.MCP_HTTP_PORT || process.env.PORT || '3333', 10);
const HOST = process.env.MCP_HTTP_HOST || '0.0.0.0';

// Optional bearer-token auth. If MCP_HTTP_TOKEN is set, every request must
// include `Authorization: Bearer <token>`.
const AUTH_TOKEN = process.env.MCP_HTTP_TOKEN;

// Active sessions (by Mcp-Session-Id). Each session has its own transport
// AND its own McpServer instance — per the SDK's recommended pattern, so
// state (registered notifications, elicitation, etc.) is isolated.
const sessions = new Map<string, { transport: any; server: any }>();

const app = express();
app.use(express.json({ limit: '4mb' }));

// CORS — allow browsers to hit the endpoint during development
app.use((req: Request, res: Response, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.MCP_HTTP_CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function checkAuth(req: Request, res: Response): boolean {
  if (!AUTH_TOKEN) return true;
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ') || header.slice(7) !== AUTH_TOKEN) {
    res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
    return false;
  }
  return true;
}

// Health / info endpoints ----------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    server: 'PortalMCP',
    transport: 'streamable-http',
    endpoint: '/mcp',
    sessions: sessions.size,
    network: process.env.ETHEREUM_NETWORK || 'mainnet'
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'PortalMCP',
    description: 'Universal AI gateway to Ethereum, over Streamable HTTP MCP transport.',
    mcp_endpoint: '/mcp',
    health: '/health',
    docs: 'https://modelcontextprotocol.io'
  });
});

// Main MCP endpoint ----------------------------------------------------------
app.post('/mcp', async (req, res) => {
  if (!checkAuth(req, res)) return;

  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let entry = sessionId ? sessions.get(sessionId) : undefined;

  try {
    if (!entry) {
      // Only the `initialize` request is allowed to create a new session.
      if (!isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'No valid MCP session. Send an initialize request first.' },
          id: null
        });
        return;
      }

      const server = createPortalServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newId: string) => {
          sessions.set(newId, { transport, server });
          // eslint-disable-next-line no-console
          console.error(`[mcp-http] session opened: ${newId}`);
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions.has(sid)) {
          sessions.delete(sid);
          console.error(`[mcp-http] session closed: ${sid}`);
        }
      };

      await server.connect(transport);
      entry = { transport, server };
    }

    await entry.transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('[mcp-http] error handling request:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: err.message || 'Internal server error' },
        id: null
      });
    }
  }
});

// Server → client notifications / streaming (GET) and session close (DELETE)
async function sessionScoped(req: Request, res: Response) {
  if (!checkAuth(req, res)) return;
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  const entry = sessionId ? sessions.get(sessionId) : undefined;
  if (!entry) {
    res.status(400).send('Invalid or missing Mcp-Session-Id');
    return;
  }
  await entry.transport.handleRequest(req, res);
}
app.get('/mcp', sessionScoped);
app.delete('/mcp', sessionScoped);

// Startup --------------------------------------------------------------------
app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`PortalMCP (Streamable HTTP) listening on http://${HOST}:${PORT}/mcp`);
  if (AUTH_TOKEN) console.log('Bearer auth: enabled (MCP_HTTP_TOKEN set)');
  else console.log('Bearer auth: disabled — set MCP_HTTP_TOKEN to require auth');
});
