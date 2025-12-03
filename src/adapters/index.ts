/**
 * PortalMCP Adapters
 * 
 * Multi-AI platform support for PortalMCP
 * 
 * Supported Platforms:
 * 
 * 1. MCP Protocol (Native)
 *    - Claude Desktop
 *    - Cursor
 *    - Windsurf
 *    - Continue
 *    - Cline
 *    - 50+ other MCP clients
 * 
 * 2. OpenAI (via openai-adapter)
 *    - ChatGPT (Custom GPTs with Actions)
 *    - OpenAI Assistants API
 *    - Azure OpenAI
 * 
 * 3. LangChain (via langchain-adapter)
 *    - OpenAI (GPT-4, GPT-3.5)
 *    - Anthropic (Claude)
 *    - Google (Gemini, PaLM)
 *    - Mistral
 *    - Cohere
 *    - Ollama (local models)
 *    - Any LangChain-supported provider
 * 
 * 4. REST API (via rest-api)
 *    - Any HTTP-capable AI system
 *    - Custom integrations
 *    - Webhooks
 *    - Automation tools (Zapier, Make, n8n)
 */

export { getOpenAITools, getOpenAIFunctions, executeOpenAIToolCall } from './openai-adapter';
export { getLangChainTools } from './langchain-adapter';
export { openAPISpec, createExpressRoutes, startRESTServer } from './rest-api';

/**
 * Quick start guide for each platform:
 * 
 * ## Claude Desktop (MCP - Native)
 * ```json
 * // claude_desktop_config.json
 * {
 *   "mcpServers": {
 *     "portalmcp": {
 *       "command": "node",
 *       "args": ["/path/to/portalmcp/dist/index.js"]
 *     }
 *   }
 * }
 * ```
 * 
 * ## ChatGPT Custom GPT
 * 1. Start REST server: `npm run api`
 * 2. In ChatGPT, create Custom GPT
 * 3. Add Action with OpenAPI spec from /openapi.json
 * 
 * ## OpenAI Assistants API
 * ```typescript
 * import { getOpenAITools, executeOpenAIToolCall } from 'portalmcp/adapters';
 * 
 * const assistant = await openai.beta.assistants.create({
 *   model: 'gpt-4-turbo',
 *   tools: getOpenAITools()
 * });
 * ```
 * 
 * ## LangChain (Any Provider)
 * ```typescript
 * import { getLangChainTools } from 'portalmcp/adapters';
 * import { ChatOpenAI } from '@langchain/openai';
 * 
 * const tools = getLangChainTools();
 * const model = new ChatOpenAI().bindTools(tools);
 * ```
 * 
 * ## Direct REST API
 * ```bash
 * # Start server
 * npm run api
 * 
 * # Call endpoints
 * curl http://localhost:3001/eth/balance/0x...
 * curl -X POST http://localhost:3001/swap -d '{"tokenIn":"ETH","tokenOut":"USDT","amount":"0.01"}'
 * ```
 */
