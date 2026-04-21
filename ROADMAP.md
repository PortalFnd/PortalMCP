# PortalMCP Roadmap

## ✅ v1.2.0 — shipped

**Transports**
- stdio MCP transport (Claude Desktop, Cursor, Windsurf, Cline, …)
- Streamable HTTP transport (Claude.ai web/mobile, ChatGPT connectors, Gemini, remote agents)
- Legacy REST / OpenAPI adapter retained for ChatGPT Custom GPT Actions

**MCP surface**
- 17 tools with `ToolAnnotations` (readOnly / destructive / idempotent / openWorld hints)
- `outputSchema` + typed `structuredContent` on read tools
- 1 static resource (`eth://wallet`)
- 3 resource templates (`eth://balance/{address}`, `eth://tx/{hash}`, `eth://token/{address}`)
- 2 slash-command prompts (`swap_tokens`, `deploy_erc20`)

**Core features**
- ETH + ERC-20 + ERC-721 + DeFi/staking operations
- Claude-authored Solidity generation (Anthropic SDK 0.90, Claude Sonnet 4.5)
- Contract compile → deploy flow (signer-backed or prepare-for-wallet)
- Universal Uniswap V3 swap (any ERC-20 pair, symbol or address)

**Multi-chain**
- Ethereum mainnet + Sepolia + Goerli + Holesky
- Arbitrum, Optimism, Base, Polygon (mainnet + testnets)
- Any EVM chain via `ETHEREUM_RPC_URL`

**Hardening**
- Modern `g.alchemy.com` URLs (old `alchemyapi.io` returns 410 — fixed)
- Placeholder-value detection for env vars
- Bearer-token auth + CORS on HTTP transport
- Smoke test (`npm run smoke`) asserting registered surface area

---

## 🎯 v1.3 — near-term

- [ ] **Elicitation** — MCP SDK ≥ 1.13 elicitation flow to confirm destructive txs in-chat before broadcast
- [ ] **Transaction simulation** — `eth_call` dry-run + revert reason decoding before signing
- [ ] **Helper tools** — `eth_get_gas_price`, `eth_lookup_ens`, `eth_estimate_gas`
- [ ] **Full `outputSchema` coverage** — add to contract/defi/token/nft tools
- [ ] **Docker image** + `docker-compose.yml`

## 🚀 v1.4 — DeFi depth

- [ ] **Multi-DEX routing** — 1inch / 0x aggregator in `eth_swap_tokens`
- [ ] **Read-only lending positions** — Aave v3, Compound v3
- [ ] **Liquidity provision** — Uniswap V3 mint/burn positions
- [ ] **Allowance management** — revoke ERC-20 approvals tool

## 🔐 v1.5 — wallets & safety

- [ ] **Hardware wallet signer** — Ledger via node-hid
- [ ] **Gnosis Safe** integration — queue txs to a multisig
- [ ] **ERC-4337 account abstraction** — session keys, sponsored gas
- [ ] **Phishing / approval hygiene** checks built into the swap flow

## 🖼️ v2.0 — NFT + analytics

- [ ] **Batch minting** and **ERC-2981 royalties** in ERC-721 generator
- [ ] **IPFS pinning** for NFT metadata (Pinata / web3.storage)
- [ ] **Marketplace listings** — OpenSea Seaport integration
- [ ] **Portfolio tool** — aggregate ERC-20 + ERC-721 holdings
- [ ] **Price alerts** via a notification resource

## 🤖 AI extensions (any version)

- [ ] Smart contract security auditor (Claude + slither pipeline)
- [ ] Sampling — server requests LLM help to summarise tx receipts / logs
- [ ] Natural-language portfolio queries ("show me my most profitable trade this month")

## 🛠️ Developer experience

- [ ] Python client/SDK
- [ ] CLI (`portalmcp call <tool> …` for scripting)
- [ ] Jest suites covering EthereumService + each tool group
- [ ] GitHub Actions CI (`npm run build && npm run smoke` on PR)
- [ ] Helm chart for Kubernetes deployments

---

## 💡 Community requests

Open an issue or PR at <https://github.com/PortalFnd/PortalMCP/issues>.

---

## Deprecated / removed

- Old `alchemyapi.io` endpoints (returned HTTP 410) — replaced by modern `g.alchemy.com` URL builder.
- `@anthropic-ai/sdk@0.6` legacy `completions.create` path — removed in favour of `messages.create` typed API in v0.90+.
- JSON-Schema-based tool registration loop — every tool now uses Zod raw-shape inputs via `registerTool`.
