# PortalMCP

**Universal AI gateway to Ethereum.** Plug any MCP-compatible AI client (Claude Desktop, Claude.ai web, ChatGPT, Gemini, Cursor, Windsurf, Cline, custom agents, …) into the Ethereum blockchain with natural language — check balances, swap tokens, mint NFTs, generate and deploy smart contracts, and more.

> **Status:** v1.2.0 — ships both **stdio** and **Streamable HTTP** MCP transports, 17 tools, 1 resource, 3 resource templates, and 2 prompts. Works on Ethereum mainnet and all major L2s (Arbitrum, Optimism, Base, Polygon) plus Sepolia/Goerli/Holesky testnets.

---

## Table of contents

- [Why PortalMCP](#why-portalmcp)
- [Compatible clients](#compatible-clients)
- [Features at a glance](#features-at-a-glance)
- [Quick start](#quick-start)
- [Client setup](#client-setup)
  - [Claude Desktop](#claude-desktop-stdio)
  - [Claude.ai web / mobile](#claudeai-web--mobile-streamable-http)
  - [Cursor / Windsurf / Cline / Continue](#cursor--windsurf--cline--continue)
  - [ChatGPT, Gemini, custom agents](#chatgpt-gemini-custom-agents)
- [Tools, resources, prompts](#tools-resources-prompts)
- [Configuration](#configuration)
- [Networks](#networks)
- [Security](#security)
- [Development](#development)
- [Architecture](#architecture)
- [Roadmap](#roadmap)
- [License](#license)

---

## Why PortalMCP

Most AI-blockchain integrations lock you to one provider or one client. PortalMCP is a **spec-compliant MCP server** — so the same server, running on your machine or in the cloud, works with every client that speaks Model Context Protocol. One config, many copilots.

- **Non-custodial** — private keys stay on your machine (or your server), never travel.
- **Live on-chain data** — resources (`eth://wallet`, `eth://balance/{address}`, `eth://tx/{hash}`, `eth://token/{address}`) give clients zero-latency context about chain state.
- **Safe by default** — every tool declares `readOnlyHint` / `destructiveHint` / `idempotentHint` so clients can show proper confirmation UX before broadcasting.
- **Structured output** — read tools return typed `structuredContent` matching their declared `outputSchema`.

---

## Compatible clients

| Client | Transport | Notes |
|---|---|---|
| Claude Desktop (macOS/Windows) | stdio | One-line config, see below |
| Claude.ai web + mobile app | Streamable HTTP | Add as "Custom Connector" (Pro/Team/Enterprise) |
| Claude Code / Claude CLI | stdio or HTTP | Either transport works |
| Cursor | stdio | Native MCP |
| Windsurf | stdio | Native MCP |
| Cline / Continue / Zed AI | stdio | Native MCP |
| ChatGPT (Team/Enterprise) | Streamable HTTP | MCP connector feature |
| ChatGPT Custom GPTs | REST (`openapi.json`) | Legacy adapter still shipped |
| Google Gemini / Vertex Agent Builder | Streamable HTTP | MCP connector |
| LangChain / LlamaIndex / OpenAI Agents SDK | either | via their MCP client adapters |
| Any HTTP-capable agent | Streamable HTTP | Plain JSON-RPC + SSE over `/mcp` |

---

## Features at a glance

### 17 tools

**General**
`eth_get_balance` · `eth_call_contract` · `eth_send_transaction`

**Contracts**
`eth_generate_contract` (Claude-authored Solidity) · `eth_compile_contract` · `eth_deploy_contract` · `eth_deploy_contract_with_signer`

**ERC-20**
`eth_create_token` · `eth_get_token_balance` · `eth_transfer_token`

**ERC-721 / NFTs**
`eth_create_nft_collection` · `eth_mint_nft` · `eth_get_nft_owner`

**DeFi**
`eth_create_staking_contract` · `eth_stake_tokens` · `eth_swap_tokens` (universal Uniswap V3 swap — any ERC-20 by symbol or address, auto-approval, slippage protection) · `eth_swap_eth_to_usdt` (alias)

### 1 static resource + 3 resource templates

- `eth://wallet` — configured signer address, network, ETH balance
- `eth://balance/{address}` — live ETH balance for any address
- `eth://tx/{hash}` — transaction + receipt (status, gas, block, logs, explorer URL)
- `eth://token/{address}` — ERC-20 metadata (name, symbol, decimals, total supply)

### 2 prompts (slash commands)

- `/swap_tokens` — guided token-swap
- `/deploy_erc20` — generate → compile → deploy flow

---

## Quick start

```bash
git clone https://github.com/PortalFnd/PortalMCP.git
cd PortalMCP/portalmcp
npm install
cp .env.example .env
# fill in .env — at minimum ANTHROPIC_API_KEY, DEPLOYER_PRIVATE_KEY,
# and ETHEREUM_RPC_URL (or a real ALCHEMY_API_KEY)
npm run build
npm run smoke           # verify 17 tools / 1 resource / 3 templates / 2 prompts
npm start               # stdio transport (for Claude Desktop, Cursor, …)
# or
npm run start:http      # Streamable HTTP on http://0.0.0.0:3333/mcp
```

---

## Client setup

### Claude Desktop (stdio)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "portalmcp": {
      "command": "node",
      "args": ["/absolute/path/to/PortalMCP/portalmcp/dist/index.js"],
      "env": {
        "ETHEREUM_NETWORK": "mainnet",
        "ETHEREUM_RPC_URL": "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
        "DEPLOYER_PRIVATE_KEY": "0x...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Restart Claude Desktop. You should see 17 tools, resources under `eth://`, and two slash commands (`/swap_tokens`, `/deploy_erc20`).

### Claude.ai web / mobile (Streamable HTTP)

1. Host the HTTP server somewhere reachable over HTTPS. Easiest: run `npm run start:http` behind Caddy/Cloudflare Tunnel/Nginx.
2. Set `MCP_HTTP_TOKEN=<long-random-string>` so only you can call it.
3. In Claude.ai: **Settings → Connectors → Add Custom Connector**.
   - URL: `https://your-host.example.com/mcp`
   - Auth header: `Authorization: Bearer <MCP_HTTP_TOKEN>`
4. Available on both web and mobile.

### Cursor / Windsurf / Cline / Continue

All native MCP — add an entry to their MCP servers config pointing at `node /absolute/path/to/dist/index.js` (same stdio command as Claude Desktop).

### ChatGPT, Gemini, custom agents

**Preferred (MCP connector — ChatGPT Team/Enterprise, Gemini/Vertex Agents):**
Point at `https://your-host/mcp`, optionally with a Bearer token.

**Legacy REST (ChatGPT Custom GPT Actions, any HTTP agent):**
```bash
npm run start:api
# OpenAPI spec: http://localhost:3001/openapi.json
```

---

## Tools, resources, prompts

### Tool cheatsheet

| Tool | Action | Signer required? |
|---|---|---|
| `eth_get_balance` | ETH balance for any address / default wallet | No |
| `eth_call_contract` | Read-only call against any ABI | No |
| `eth_send_transaction` | Prepare a generic unsigned tx | No (prep only) |
| `eth_generate_contract` | Claude-authored Solidity | No (needs ANTHROPIC_API_KEY) |
| `eth_compile_contract` | solc compile → bytecode + ABI | No |
| `eth_deploy_contract` | Prepare deployment tx for external wallet | No |
| `eth_deploy_contract_with_signer` | Deploy directly using `DEPLOYER_PRIVATE_KEY` | **Yes** |
| `eth_create_token` | Generate ERC-20 Solidity | No |
| `eth_get_token_balance` | ERC-20 balance | No |
| `eth_transfer_token` | Transfer ERC-20 (sign+send by default) | Yes (unless `executeTransaction=false`) |
| `eth_create_nft_collection` | Generate ERC-721 Solidity | No |
| `eth_mint_nft` | Prepare mint / safeMint / mintWithURI | No (prep only) |
| `eth_get_nft_owner` | `ownerOf()` lookup | No |
| `eth_create_staking_contract` | Generate staking Solidity | No |
| `eth_stake_tokens` | Prepare approve + stake txs | No (prep only) |
| `eth_swap_tokens` | Uniswap V3 swap (any pair, executes by default) | Yes |
| `eth_swap_eth_to_usdt` | Alias for ETH→USDT convenience | Yes |

### Example conversations

**Deploy a token from scratch**
> "Deploy an ERC-20 called PortalToken (PRTL) with initial supply 1,000,000."

Claude runs `eth_generate_contract` → shows code → `eth_compile_contract` → `eth_deploy_contract_with_signer` → returns the contract address and Etherscan link.

**Universal swap**
> "Swap 0.01 ETH for USDC."

Claude calls `eth_swap_tokens { tokenIn:"ETH", tokenOut:"USDC", amount:"0.01" }` which approves (if needed) and executes via Uniswap V3.

**Ask about any address**
> "What's the balance of vitalik.eth?" *(client resolves ENS, then attaches the `eth://balance/0xd8dA…` resource)*

---

## Configuration

All configuration is via environment variables (`.env` file or host env). See `.env.example` for the full list.

| Var | Required | Purpose |
|---|---|---|
| `ETHEREUM_NETWORK` | no (default `mainnet`) | `mainnet`, `sepolia`, `holesky`, `arbitrum`, `optimism`, `base`, `polygon`, … |
| `ETHEREUM_RPC_URL` | preferred | Full JSON-RPC URL (overrides Infura/Alchemy key-based setup) |
| `ALCHEMY_API_KEY` | alt | Key only — PortalMCP builds the modern `g.alchemy.com` URL |
| `INFURA_API_KEY` | alt | Infura project ID |
| `DEPLOYER_PRIVATE_KEY` | for writes | `0x`-prefixed hex — enables signer-backed tools (swap/transfer/deploy) |
| `ANTHROPIC_API_KEY` | for `eth_generate_contract` | Claude API key |
| `ANTHROPIC_MODEL` | no | Override default `claude-sonnet-4-5-20250929` |
| `MCP_HTTP_PORT` | no (default `3333`) | HTTP transport port |
| `MCP_HTTP_HOST` | no (default `0.0.0.0`) | HTTP transport bind address |
| `MCP_HTTP_TOKEN` | recommended for HTTP | Bearer token required on every request |
| `MCP_HTTP_CORS_ORIGIN` | no (default `*`) | Restrict CORS origin |
| `GAS_PRICE_MULTIPLIER` | no (default `1.1`) | Gas price padding |

**Placeholder detection:** any env value starting with `your_`, `replace_`, `xxx`, `changeme`, `example`, `placeholder`, or `<…>` is treated as unset. Stops silent misconfigurations dead.

---

## Networks

Out of the box:

- **L1:** mainnet, sepolia, goerli, holesky
- **L2:** arbitrum + arbitrum-sepolia, optimism + optimism-sepolia, base + base-sepolia, polygon + polygon-amoy

Swap networks by setting `ETHEREUM_NETWORK` or point at any RPC via `ETHEREUM_RPC_URL` (works for any EVM chain — BSC, Avalanche, Linea, zkSync, etc.).

---

## Security

- **Keep `.env` private.** It's in `.gitignore`; never commit it.
- **`DEPLOYER_PRIVATE_KEY` is a loaded gun.** Anyone with it fully controls that wallet. Prefer a dedicated "agent wallet" with only the funds you're willing to risk.
- **Always set `MCP_HTTP_TOKEN`** when exposing the HTTP endpoint beyond localhost. Put a TLS-terminating reverse proxy in front.
- **Testnet first.** Use `sepolia` for development; switch to mainnet only after verifying the flow.
- **Tool annotations** (`destructiveHint`, `idempotentHint`) let clients prompt for confirmation before broadcasting — don't auto-approve destructive tools in your client settings.
- **Contract review.** `eth_generate_contract` is a starting point, not an audit. Review and test any generated Solidity before deploying.

---

## Development

```bash
npm install
npm run dev          # stdio, ts-node hot-reload
npm run dev:http     # Streamable HTTP, ts-node
npm run build        # tsc → dist/
npm run smoke        # spawn stdio server + assert tools/resources/prompts
npm test             # Jest (add more tests — contributions welcome)
```

### Scripts

| Script | What it does |
|---|---|
| `npm start` | stdio MCP server (production) |
| `npm run start:http` | Streamable HTTP MCP server (production) |
| `npm run start:api` | Legacy REST API (for ChatGPT Actions / non-MCP clients) |
| `npm run dev` | stdio + ts-node |
| `npm run dev:http` | HTTP + ts-node |
| `npm run dev:api` | REST + ts-node |
| `npm run smoke` | Registration smoke test |

### Repo layout

```
portalmcp/
├── src/
│   ├── index.ts              # stdio entrypoint
│   ├── mcp-http.ts           # Streamable HTTP entrypoint
│   ├── server-factory.ts     # createPortalServer() — shared wiring
│   ├── smoke-test.ts         # CI registration check
│   ├── tools/                # tool modules (general, contracts, defi, tokens, nfts)
│   ├── blockchain/           # EthereumService, CompilerService
│   ├── claude/               # ContractGenerator (Anthropic SDK)
│   ├── contracts/            # Solidity templates
│   └── adapters/             # Legacy REST / LangChain / OpenAI adapters
├── dist/                     # tsc output
├── .env.example
└── package.json
```

---

## Architecture

```
          stdio                               Streamable HTTP (SSE)
┌─────────────────────┐                ┌───────────────────────────┐
│  Claude Desktop     │                │  Claude.ai web/mobile     │
│  Cursor, Windsurf   │                │  ChatGPT, Gemini          │
│  Cline, Continue    │                │  Custom agents            │
└──────────┬──────────┘                └─────────────┬─────────────┘
           │                                         │
           │        ┌──────────────────────┐         │
           └───────▶│   PortalMCP server   │◀────────┘
                    │  (server-factory.ts) │
                    └──────────┬───────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
  EthereumService          Uniswap V3              Anthropic
  (ethers v6 +            (eth_swap_tokens)      (eth_generate_contract)
   Alchemy/Infura/
   custom RPC)
```

---

## Roadmap

### Shipped ✅
- MCP SDK 1.29 — stdio + Streamable HTTP transports
- 17 tools, 1 resource, 3 resource templates, 2 prompts
- Tool annotations + `outputSchema` on read tools
- Universal Uniswap V3 swap (any ERC-20 pair)
- Multi-chain support (Ethereum, Arbitrum, Optimism, Base, Polygon + testnets)
- Anthropic SDK 0.90 + Claude Sonnet 4.5 default
- Placeholder detection for env vars
- Modern `g.alchemy.com` endpoints (old alchemyapi.io returns 410 — fixed)
- Smoke test for CI
- Legacy REST adapter retained for ChatGPT Custom GPTs

### In progress / next
- [ ] Elicitation (confirm before broadcasting destructive txs)
- [ ] `eth_get_gas_price`, `eth_lookup_ens` helper tools
- [ ] More `outputSchema` coverage across contract/defi/token/nft tools
- [ ] Transaction simulation (eth_call + revert reason decoding) before broadcast
- [ ] ERC-4337 account abstraction / session keys
- [ ] Multi-DEX routing (1inch, 0x aggregator) for `eth_swap_tokens`
- [ ] Read-only helpers for Aave / Compound positions
- [ ] Hardware-wallet signer adapter (Ledger)
- [ ] Docker image + Helm chart
- [ ] Python SDK / CLI for non-MCP usage

---

## Contributing

PRs welcome! Priority areas: additional tools, more `outputSchema` coverage, Docker packaging, Python client, and test coverage. Open an issue first for non-trivial changes.

---

## License

[MIT](./LICENSE) © Portal Foundation
