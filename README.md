<div align="center">

# 🌐 PortalMCP

### Universal AI gateway to Ethereum

**One server. Every AI. The whole chain.**

Plug any Model-Context-Protocol client — Claude, ChatGPT, Gemini, Cursor, Windsurf, Cline, custom agents — into Ethereum with natural language. Check balances, swap tokens, mint NFTs, generate and deploy smart contracts.

[![MCP SDK](https://img.shields.io/badge/MCP%20SDK-1.29-blue)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Ethers](https://img.shields.io/badge/ethers-v6.16-7b3fe4)](https://docs.ethers.org/v6/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Release](https://img.shields.io/badge/release-v1.2.0-brightgreen)](./CHANGELOG.md)

[**Quick start**](#-quick-start) · [**Setup**](#-client-setup) · [**Tools**](#-what-it-can-do) · [**Roadmap**](./ROADMAP.md) · [**Changelog**](./CHANGELOG.md)

</div>

---

## ✨ Why PortalMCP

Most AI-blockchain integrations lock you to one LLM or one client. PortalMCP is a spec-compliant **MCP server** — the same server, running locally or on your VPS, powers every MCP-capable client.

> 🔐 **Non-custodial** — private keys never leave your machine
> 🛰️ **Live chain context** — resources stream ETH balances, tx receipts and token metadata straight into your chat
> 🛡️ **Safety-first** — every tool declares read/destructive/idempotent hints so clients can confirm before broadcasting
> 🧩 **Universal** — works over both stdio and HTTP, plays with every MCP client out there

---

## 🧭 Compatible clients

| Client | Transport | Notes |
|---|---|---|
| 🟣 **Claude Desktop** (macOS/Windows) | stdio | Drop-in config below |
| 🌐 **Claude.ai web + mobile** | HTTP | Add as *Custom Connector* (Pro/Team/Enterprise) |
| 💻 **Claude Code / CLI** | either | |
| 🧠 **Cursor · Windsurf · Cline · Continue · Zed AI** | stdio | Native MCP |
| 💬 **ChatGPT** (Team/Enterprise) | HTTP | MCP connector |
| 🛠️ **ChatGPT Custom GPTs** | REST | Uses bundled `openapi.json` |
| ✴️ **Google Gemini / Vertex Agents** | HTTP | MCP connector |
| 🐍 **LangChain · LlamaIndex · OpenAI Agents SDK** | either | via their MCP adapters |
| 🤖 **Any HTTP agent** | HTTP | Plain JSON-RPC + SSE on `/mcp` |

---

## 🎯 What it can do

<details open>
<summary><b>17 tools</b> — click to expand</summary>

#### ⚡ General
| Tool | Action |
|---|---|
| `eth_get_balance` | ETH balance of any address or the default wallet |
| `eth_call_contract` | Read-only call against any contract + ABI |
| `eth_send_transaction` | Prepare a generic unsigned transaction |

#### 📜 Smart contracts
| Tool | Action |
|---|---|
| `eth_generate_contract` | Claude-authored Solidity from natural language |
| `eth_compile_contract` | solc compile → bytecode + ABI |
| `eth_deploy_contract` | Prepare deployment tx for external wallet signing |
| `eth_deploy_contract_with_signer` | Deploy directly using `DEPLOYER_PRIVATE_KEY` |

#### 🪙 ERC-20 tokens
| Tool | Action |
|---|---|
| `eth_create_token` | Generate ERC-20 Solidity |
| `eth_get_token_balance` | ERC-20 balance of any holder |
| `eth_transfer_token` | Signed transfer or unsigned-tx prep |

#### 🖼️ ERC-721 NFTs
| Tool | Action |
|---|---|
| `eth_create_nft_collection` | Generate ERC-721 Solidity |
| `eth_mint_nft` | Prepare `mint` / `safeMint` / `mintWithURI` |
| `eth_get_nft_owner` | `ownerOf()` lookup |

#### 🏦 DeFi
| Tool | Action |
|---|---|
| `eth_create_staking_contract` | Generate staking Solidity |
| `eth_stake_tokens` | Prepare approve + stake txs |
| `eth_swap_tokens` | Universal Uniswap V3 swap (any ERC-20 pair) |
| `eth_swap_eth_to_usdt` | Convenience alias of the above |

</details>

<details>
<summary><b>4 resources</b> (live chain data as context)</summary>

| URI | Returns |
|---|---|
| `eth://wallet` | Configured signer address, network, ETH balance |
| `eth://balance/{address}` | Live ETH balance for any address |
| `eth://tx/{hash}` | Transaction + receipt (status, gas, block, logs, explorer URL) |
| `eth://token/{address}` | ERC-20 metadata (name, symbol, decimals, total supply) |

</details>

<details>
<summary><b>2 prompts</b> (slash commands)</summary>

- `/swap_tokens` — guided token-swap flow
- `/deploy_erc20` — generate → compile → deploy end-to-end

</details>

---

## 🚀 Quick start

```bash
git clone https://github.com/PortalFnd/PortalMCP.git
cd PortalMCP/portalmcp
npm install
cp .env.example .env
# fill in .env — ANTHROPIC_API_KEY, DEPLOYER_PRIVATE_KEY,
# and ETHEREUM_RPC_URL (or a real ALCHEMY_API_KEY)
npm run build
npm run smoke          # ✓ 17 tools / 1 resource / 3 templates / 2 prompts
npm start              # stdio (Claude Desktop, Cursor, …)
# or
npm run start:http     # Streamable HTTP on http://0.0.0.0:3333/mcp
```

---

## 🔌 Client setup

<details open>
<summary><b>🟣 Claude Desktop</b> (stdio)</summary>

<br>

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

Restart Claude Desktop. 17 tools, `eth://` resources, and two slash commands appear automatically.

</details>

<details>
<summary><b>🌐 Claude.ai web / mobile</b> (Streamable HTTP)</summary>

<br>

1. Host the HTTP server with a public HTTPS URL (Caddy / Cloudflare Tunnel / Nginx).
2. Set `MCP_HTTP_TOKEN=<long-random-string>` so only you can call it.
3. In Claude.ai → **Settings → Connectors → Add Custom Connector**:
   - **URL:** `https://your-host.example.com/mcp`
   - **Auth:** `Authorization: Bearer <MCP_HTTP_TOKEN>`
4. Works on both web and the mobile app.

</details>

<details>
<summary><b>🧠 Cursor / Windsurf / Cline / Continue</b></summary>

<br>

All speak MCP natively. Add an entry to their MCP config pointing at:
```
node /absolute/path/to/PortalMCP/portalmcp/dist/index.js
```
(Same stdio command as Claude Desktop.)

</details>

<details>
<summary><b>💬 ChatGPT, Gemini, custom agents</b></summary>

<br>

**Preferred — MCP connector** (ChatGPT Team/Enterprise, Gemini/Vertex Agents):
Point at `https://your-host/mcp`, optionally with a Bearer token.

**Legacy REST** (ChatGPT Custom GPT Actions or any HTTP agent):
```bash
npm run start:api
# OpenAPI spec: http://localhost:3001/openapi.json
```

</details>

---

## 💬 Example conversations

> **Deploy a token from scratch**
>
> *"Deploy an ERC-20 called PortalToken (PRTL) with initial supply 1,000,000."*
>
> → `eth_generate_contract` → shows code → `eth_compile_contract` → `eth_deploy_contract_with_signer` → returns the contract address + Etherscan link.

> **Universal swap**
>
> *"Swap 0.01 ETH for USDC."*
>
> → `eth_swap_tokens { tokenIn:"ETH", tokenOut:"USDC", amount:"0.01" }` — approves (if needed) and executes via Uniswap V3.

> **Live on-chain context**
>
> *"What's the balance of `vitalik.eth`?"*
>
> → client attaches the `eth://balance/0xd8dA…` resource straight into the conversation.

---

## ⚙️ Configuration

All via env vars (`.env` file or host env). Full list in `.env.example`.

| Var | Required | Purpose |
|---|:---:|---|
| `ETHEREUM_NETWORK` | – | `mainnet`, `sepolia`, `arbitrum`, `optimism`, `base`, `polygon`, … (default `mainnet`) |
| `ETHEREUM_RPC_URL` | ⭐ | Full JSON-RPC URL — overrides Infura/Alchemy key setup |
| `ALCHEMY_API_KEY` | alt | Key only — PortalMCP builds the modern `g.alchemy.com` URL |
| `INFURA_API_KEY` | alt | Infura project ID |
| `DEPLOYER_PRIVATE_KEY` | writes | `0x`-prefixed hex — enables signer-backed tools |
| `ANTHROPIC_API_KEY` | generate | For `eth_generate_contract` |
| `ANTHROPIC_MODEL` | – | Override default `claude-sonnet-4-5-20250929` |
| `MCP_HTTP_PORT` | – | Default `3333` |
| `MCP_HTTP_HOST` | – | Default `0.0.0.0` |
| `MCP_HTTP_TOKEN` | 🛡️ | Bearer token for the HTTP transport |
| `MCP_HTTP_CORS_ORIGIN` | – | Default `*` |

> 💡 **Placeholder detection** — any env value starting with `your_`, `changeme`, `xxx`, `placeholder`, `<…>` is treated as unset. Stops silent misconfigurations dead.

---

## 🌍 Networks supported

<table>
<tr><td><b>L1</b></td><td>Ethereum mainnet · Sepolia · Goerli · Holesky</td></tr>
<tr><td><b>L2</b></td><td>Arbitrum · Optimism · Base · Polygon <em>(+ every testnet)</em></td></tr>
<tr><td><b>Custom</b></td><td>Any EVM chain — BSC, Avalanche, Linea, zkSync, … — via <code>ETHEREUM_RPC_URL</code></td></tr>
</table>

---

## 🛡️ Security

- 🚫 **Never commit `.env`** — already in `.gitignore`.
- 🔑 **`DEPLOYER_PRIVATE_KEY` is a loaded gun.** Use a dedicated agent wallet with only funds you can lose.
- 🛰️ **Always set `MCP_HTTP_TOKEN`** when exposing HTTP beyond localhost, and put TLS (Caddy/Cloudflare) in front.
- 🧪 **Testnet first** — use `sepolia` for development, mainnet only after you've verified the flow.
- 🏷️ **Tool annotations** let clients prompt before destructive txs — don't auto-approve them.
- 👀 **Review generated Solidity** — `eth_generate_contract` is a starting point, not an audit.

---

## 🧑‍💻 Development

```bash
npm install
npm run dev          # stdio, ts-node hot-reload
npm run dev:http     # HTTP, ts-node
npm run build        # tsc → dist/
npm run smoke        # assert MCP surface is registered
npm test             # Jest
```

| Script | Purpose |
|---|---|
| `npm start` | stdio MCP server (prod) |
| `npm run start:http` | Streamable HTTP MCP server (prod) |
| `npm run start:api` | Legacy REST for ChatGPT Actions / HTTP clients |
| `npm run smoke` | Registration smoke test — great for CI |

### Repo layout

```
portalmcp/
├── src/
│   ├── index.ts              # stdio entrypoint
│   ├── mcp-http.ts           # Streamable HTTP entrypoint
│   ├── server-factory.ts     # createPortalServer() — shared wiring
│   ├── smoke-test.ts         # CI registration check
│   ├── tools/                # general · contracts · defi · tokens · nfts
│   ├── blockchain/           # EthereumService · CompilerService
│   ├── claude/               # ContractGenerator (Anthropic SDK)
│   ├── contracts/            # Solidity templates
│   └── adapters/             # Legacy REST / LangChain / OpenAI adapters
├── dist/                     # tsc output
├── .env.example
└── package.json
```

---

## 🏗️ Architecture

```
          stdio                                 Streamable HTTP (SSE)
┌─────────────────────┐                  ┌─────────────────────────────┐
│  Claude Desktop     │                  │   Claude.ai web + mobile    │
│  Cursor · Windsurf  │                  │   ChatGPT · Gemini          │
│  Cline · Continue   │                  │   Custom agents             │
└─────────┬───────────┘                  └──────────────┬──────────────┘
          │                                             │
          │        ┌──────────────────────┐             │
          └───────▶│   PortalMCP server   │◀────────────┘
                   │  (server-factory.ts) │
                   └──────────┬───────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
  EthereumService         Uniswap V3             Anthropic
  (ethers v6 +        (eth_swap_tokens)      (eth_generate_contract)
   Alchemy/Infura/
   custom RPC)
```

---

## 🗺️ Roadmap highlights

<table>
<tr>
  <td valign="top"><b>Shipped ✅</b><br><br>
    MCP SDK 1.29 — stdio + HTTP<br>
    17 tools · 1 resource · 3 templates · 2 prompts<br>
    Tool annotations + outputSchema<br>
    Universal Uniswap V3 swap<br>
    L1 + L2 + testnets<br>
    Anthropic SDK 0.90 · Claude Sonnet 4.5<br>
    Smoke test for CI
  </td>
  <td valign="top"><b>Next 🔭</b><br><br>
    Elicitation (confirm destructive txs)<br>
    ENS / gas helpers<br>
    Tx simulation with revert decoding<br>
    Multi-DEX aggregation (1inch, 0x)<br>
    Aave / Compound read positions<br>
    Ledger hardware signer<br>
    Gnosis Safe + ERC-4337<br>
    Docker + Python SDK
  </td>
</tr>
</table>

Full plan in [ROADMAP.md](./ROADMAP.md).

---

## 🤝 Contributing

PRs welcome! Priority areas: more `outputSchema` coverage, additional tools, Docker packaging, Python client, test coverage. Open an issue first for non-trivial changes.

---

<div align="center">

**[⭐ Star this repo](https://github.com/PortalFnd/PortalMCP)** · **[🐛 Report an issue](https://github.com/PortalFnd/PortalMCP/issues)** · **[📜 MIT License](./LICENSE)**

Built with 💜 by the **Portal Foundation**

</div>
