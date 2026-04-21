# Changelog

All notable changes to PortalMCP are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [1.2.0] — 2026-04-21

### Added
- **Streamable HTTP transport** (`src/mcp-http.ts`) at `POST/GET/DELETE /mcp` — enables Claude.ai web/mobile, ChatGPT connectors, Gemini/Vertex agents, and any remote MCP client to connect without stdio. Per-session isolation, SSE streaming, optional Bearer auth (`MCP_HTTP_TOKEN`), configurable CORS.
- **Shared server factory** (`src/server-factory.ts`) — `createPortalServer()` guarantees both transports expose an identical MCP surface.
- **Resources**
  - Static: `eth://wallet`
  - Templates: `eth://balance/{address}`, `eth://tx/{hash}`, `eth://token/{address}`
- **Prompts** — `swap_tokens`, `deploy_erc20` (slash-commands).
- **Tool annotations** on every tool: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.
- **`outputSchema`** on read tools (starting with `eth_get_balance`) — typed `structuredContent`.
- **Multi-chain Alchemy subdomain map** — Arbitrum / Optimism / Base / Polygon + their testnets work out of the box.
- **`ETHEREUM_RPC_URL` env var** — explicit RPC takes priority over key-based providers.
- **Placeholder detection** — env values starting with `your_`, `replace_`, `xxx`, `changeme`, `example`, `placeholder`, `<…>` are treated as unset.
- **Smoke test** (`npm run smoke`) — spawns stdio server and asserts all 17 tools / 1 resource / 3 templates / 2 prompts are registered.
- New npm scripts: `start:http`, `dev:http`, `smoke`.

### Changed
- Bumped `@modelcontextprotocol/sdk` 1.12 → **1.29**.
- Bumped `@anthropic-ai/sdk` 0.6.8 → **0.90** — rewritten to use `import Anthropic from …` and typed `content` blocks.
- Default Claude model bumped to `claude-sonnet-4-5-20250929`; override via `ANTHROPIC_MODEL`.
- Bumped `ethers` 6.14 → 6.16, `solc` 0.8.30 → 0.8.34, `typescript` 5.8 → 5.9, `dotenv`/`ts-jest`/`ts-node` patch versions.
- `eth_transfer_token` now defaults to signer-backed execution; pass `executeTransaction=false` for the previous prepare-only behaviour.
- Rewrote `tokens.ts` and `nfts.ts` from the legacy JSON-Schema `MCPTool[]` array to the modern `registerXxxTools(server)` pattern with Zod raw-shape inputs and `{ content, structuredContent, isError }` responses.

### Fixed
- **Empty token/NFT input schemas.** The previous loop in `index.ts` passed JSON Schema to `registerTool`'s `inputSchema`, which the SDK interprets as a Zod raw shape — yielding `properties: {}` for 6 tools. All 17 tools now advertise their correct schemas.
- **Alchemy HTTP 410 Gone.** Ethers v6's `AlchemyProvider` still targets the decommissioned `eth-mainnet.alchemyapi.io`. PortalMCP now builds the modern `g.alchemy.com` URL directly.
- **Silent placeholder poisoning.** Default `.env.example` values like `your_alchemy_api_key_here` were being treated as real keys and sending requests to dead endpoints. Now rejected at init.

### Removed
- Legacy `completions.create` code path in `ContractGenerator.ts` (old Anthropic SDK).
- Broken `import { MCPTool } from '@modelcontextprotocol/sdk'` top-level type import (the SDK has no top-level export).

---

## [1.0.0] — initial

- Initial release with stdio MCP transport, Claude-based contract generation, ERC-20 / ERC-721 / staking / Uniswap V3 swap tools, and a REST adapter for ChatGPT Custom GPTs.
