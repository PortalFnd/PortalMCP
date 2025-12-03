# PortalMCP - Universal AI Gateway to Ethereum

A multi-platform AI integration layer for Ethereum blockchain. Works with **Claude, ChatGPT, Gemini, LLaMA, Mistral**, and any LangChain-supported model. Deploy contracts, swap tokens, mint NFTs, and more - all through natural language.

## 🌐 Supported AI Platforms

| Platform | Integration | Status |
|----------|-------------|--------|
| **Claude Desktop** | Native MCP | ✅ Full Support |
| **ChatGPT** | REST API / Custom GPT | ✅ Full Support |
| **Cursor** | Native MCP | ✅ Full Support |
| **Windsurf** | Native MCP | ✅ Full Support |
| **OpenAI API** | Function Calling | ✅ Full Support |
| **Google Gemini** | LangChain | ✅ Full Support |
| **Mistral** | LangChain | ✅ Full Support |
| **Ollama** | LangChain | ✅ Full Support |
| **Any LLM** | REST API | ✅ Full Support |

## Architecture Overview

```
                    ┌─────────────────┐
                    │   Claude/MCP    │──── Native MCP Protocol
                    └────────┬────────┘
                             │
┌─────────────┐    ┌────────▼────────┐    ┌─────────────────┐
│  ChatGPT    │───▶│                 │───▶│                 │
│  Gemini     │    │   PortalMCP     │    │    Ethereum     │
│  Mistral    │───▶│                 │───▶│   Blockchain    │
│  Ollama     │    │  (Adapters)     │    │                 │
└─────────────┘    └─────────────────┘    └─────────────────┘
       │                   │
       └── LangChain ──────┘
       └── REST API ───────┘
```

PortalMCP bridges the gap between AI and blockchain, allowing you to perform complex Ethereum operations through simple natural language requests with ANY AI model.

## Features

### Contract Generation & Deployment
- Generate Solidity code via Claude
- Compile Solidity to bytecode
- Deploy to network (user signs via wallet)

### Token Operations (ERC-20)
- Full ERC-20 creation flow
- Check token balances
- Transfer tokens

### NFT Operations
- Deploy NFT contracts
- Mint NFTs
- Check NFT ownership

### DeFi Operations
- Simple staking contracts
- Stake tokens
- DEX interactions

### General Blockchain
- Get ETH balance
- Call any contract function
- Send transactions

## Installation

### Prerequisites
- Node.js v16 or higher
- npm or yarn
- An Ethereum wallet (MetaMask recommended)
- Access to Claude API

### Setup

1. Clone the repository
   ```bash
   git clone https://github.com/PortalFnd/portalmcp.git
   cd portalmcp
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`
   ```bash
   cp .env.example .env
   ```

4. Add your API keys to the `.env` file
   ```
   ANTHROPIC_API_KEY=your_claude_api_key
   INFURA_API_KEY=your_infura_key
   # or
   ALCHEMY_API_KEY=your_alchemy_key
   ```

5. Build the project
   ```bash
   npm run build
   ```

6. Start the MCP server
   ```bash
   npm start
   ```

## Quick Start by Platform

### 🟣 Claude Desktop (Native MCP)

Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS):

```json
{
  "mcpServers": {
    "portalmcp": {
      "command": "node",
      "args": ["/absolute/path/to/portalmcp/dist/index.js"],
      "env": {
        "ETHEREUM_NETWORK": "mainnet",
        "INFURA_API_KEY": "your_infura_key",
        "DEPLOYER_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

### 🟢 ChatGPT (Custom GPT)

1. Start the REST API server:
   ```bash
   npm run start:api
   ```

2. Create a Custom GPT in ChatGPT
3. Add an Action with the OpenAPI spec from `http://localhost:3001/openapi.json`
4. For production, deploy to a public URL and use that instead

### 🔵 OpenAI Assistants API

```typescript
import OpenAI from 'openai';
import { getOpenAITools, executeOpenAIToolCall } from 'portalmcp/adapters';

const openai = new OpenAI();

// Create assistant with Ethereum tools
const assistant = await openai.beta.assistants.create({
  name: 'Ethereum Assistant',
  model: 'gpt-4-turbo',
  tools: getOpenAITools()
});

// Handle function calls
const result = await executeOpenAIToolCall('eth_get_balance', { address: '0x...' });
```

### 🟡 LangChain (Any LLM Provider)

```typescript
import { getLangChainTools } from 'portalmcp/adapters';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const tools = getLangChainTools();

// Works with ANY provider!
const openai = new ChatOpenAI({ model: 'gpt-4-turbo' }).bindTools(tools);
const claude = new ChatAnthropic({ model: 'claude-3-opus' }).bindTools(tools);
const gemini = new ChatGoogleGenerativeAI({ model: 'gemini-pro' }).bindTools(tools);
```

### 🟠 REST API (Universal)

```bash
# Start server
npm run start:api

# Check balance
curl http://localhost:3001/eth/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f...

# Swap tokens
curl -X POST http://localhost:3001/swap \
  -H "Content-Type: application/json" \
  -d '{"tokenIn":"ETH","tokenOut":"USDT","amount":"0.01"}'

# Get OpenAPI spec (for any integration)
curl http://localhost:3001/openapi.json
```

> **Note:** Replace paths and keys with your actual values. For testnet development, change `ETHEREUM_NETWORK` to `sepolia`.

## Example Conversations

### Creating a Token

**User**: "Create an ERC-20 token called 'MyToken' with symbol 'MTK' and supply of 1 million"

**Claude** (using MCP tools):
1. Uses `eth_generate_contract` to create Solidity code
2. Shows you the code for review
3. Uses `eth_deploy_contract` after your approval
4. Returns contract address and details

### Checking Balances

**User**: "What's my USDC balance on Ethereum?"

**Claude**: Uses `eth_get_token_balance` and responds: "Your USDC balance is 1,250.50 USDC"

### NFT Creation

**User**: "Deploy an NFT collection called 'Digital Art' and mint token #1 to my address"

**Claude**: 
1. Uses `eth_create_nft_collection`
2. Uses `eth_mint_nft` 
3. Provides transaction hashes and opensea links

## Security Model

1. **Non-custodial**: Never handle private keys
2. **User approval**: All transactions require user wallet signature
3. **Code review**: Show generated contracts before deployment
4. **Network isolation**: Support testnets for development

## Available MCP Tools

### Contract Operations
- `eth_generate_contract` - Generate Solidity code via Claude
- `eth_compile_contract` - Compile Solidity to bytecode
- `eth_deploy_contract` - Deploy to network

### Token Operations
- `eth_create_token` - Create ERC-20 token
- `eth_get_token_balance` - Check token balance
- `eth_transfer_token` - Transfer tokens

### NFT Operations
- `eth_create_nft_collection` - Create NFT collection
- `eth_mint_nft` - Mint NFT
- `eth_get_nft_owner` - Check NFT ownership

### DeFi Operations
- `eth_create_staking_contract` - Create staking contract
- `eth_stake_tokens` - Stake tokens
- `eth_swap_tokens` - Swap tokens on DEX

### General Operations
- `eth_get_balance` - Get ETH balance
- `eth_call_contract` - Call contract function
- `eth_send_transaction` - Send transaction

## Security

⚠️ **Important Security Notes:**

- **Never commit your `.env` file** - It contains sensitive API keys and private keys
- **Use testnets first** - Always test on Sepolia before mainnet
- **Review transactions** - Always review transaction details before signing
- **Private key safety** - The `DEPLOYER_PRIVATE_KEY` gives full control over that wallet

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
