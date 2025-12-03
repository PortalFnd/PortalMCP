/**
 * LangChain Adapter for PortalMCP
 * 
 * Converts PortalMCP tools to LangChain format
 * Works with ANY LLM provider: OpenAI, Anthropic, Google, Mistral, Ollama, etc.
 */

import { ethers } from 'ethers';
import { EthereumService } from '../blockchain/EthereumService';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

/**
 * LangChain Tool Definition
 * Compatible with @langchain/core DynamicStructuredTool
 */
export interface LangChainToolDef {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  func: (input: Record<string, any>) => Promise<string>;
}

/**
 * Create LangChain-compatible tools from PortalMCP
 */
export function getLangChainTools(): LangChainToolDef[] {
  return [
    {
      name: 'eth_get_balance',
      description: 'Get ETH balance for an Ethereum address. Returns balance in ETH.',
      schema: {
        type: 'object',
        properties: {
          address: { 
            type: 'string', 
            description: 'Ethereum address (0x...). Optional if wallet is configured.' 
          }
        }
      },
      func: async (input) => {
        const address = input.address || ethereumService.getSigner()?.address;
        if (!address) {
          return 'Error: No address provided and no default wallet configured';
        }
        const balance = await ethereumService.getBalance(address);
        return `Balance: ${balance} ETH (Address: ${address}, Network: ${ethereumService.getNetwork()})`;
      }
    },
    {
      name: 'eth_get_token_balance',
      description: 'Get ERC-20 token balance for an address',
      schema: {
        type: 'object',
        properties: {
          tokenAddress: { type: 'string', description: 'ERC-20 token contract address' },
          walletAddress: { type: 'string', description: 'Wallet address to check' }
        },
        required: ['tokenAddress']
      },
      func: async (input) => {
        const walletAddress = input.walletAddress || ethereumService.getSigner()?.address;
        if (!walletAddress) {
          return 'Error: No wallet address provided';
        }
        const balance = await ethereumService.getTokenBalance(input.tokenAddress, walletAddress);
        return `Token Balance: ${balance}`;
      }
    },
    {
      name: 'eth_swap_tokens',
      description: 'Swap tokens on Uniswap V3. Supports ETH, WETH, USDT, USDC, DAI, LINK, UNI, PEPE or any ERC-20 contract address.',
      schema: {
        type: 'object',
        properties: {
          tokenIn: { type: 'string', description: 'Token to swap from (symbol like ETH, USDT or contract address)' },
          tokenOut: { type: 'string', description: 'Token to swap to (symbol or contract address)' },
          amount: { type: 'string', description: 'Amount to swap (e.g., "0.01")' },
          slippageTolerance: { type: 'string', description: 'Slippage tolerance % (default: 0.5)' }
        },
        required: ['tokenIn', 'tokenOut', 'amount']
      },
      func: async (input) => {
        // This would integrate with the actual swap logic
        return `Swap prepared: ${input.amount} ${input.tokenIn} → ${input.tokenOut} (slippage: ${input.slippageTolerance || '0.5'}%)`;
      }
    },
    {
      name: 'eth_send_transaction',
      description: 'Send ETH to an address',
      schema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address' },
          value: { type: 'string', description: 'Amount of ETH to send' }
        },
        required: ['to', 'value']
      },
      func: async (input) => {
        const signer = ethereumService.getSigner();
        if (!signer) {
          return 'Error: No signer configured. Set DEPLOYER_PRIVATE_KEY.';
        }
        const tx = await signer.sendTransaction({
          to: input.to,
          value: ethers.parseEther(input.value)
        });
        await tx.wait();
        return `Transaction sent! Hash: ${tx.hash}`;
      }
    },
    {
      name: 'eth_call_contract',
      description: 'Call a read-only function on a smart contract',
      schema: {
        type: 'object',
        properties: {
          contractAddress: { type: 'string', description: 'Contract address' },
          abi: { type: 'string', description: 'Function ABI as JSON string' },
          functionName: { type: 'string', description: 'Function name' },
          args: { type: 'string', description: 'Function arguments as JSON array' }
        },
        required: ['contractAddress', 'abi', 'functionName']
      },
      func: async (input) => {
        const provider = ethereumService.getProvider();
        const abi = JSON.parse(input.abi);
        const args = input.args ? JSON.parse(input.args) : [];
        const contract = new ethers.Contract(input.contractAddress, abi, provider);
        const result = await contract[input.functionName](...args);
        return `Result: ${result.toString()}`;
      }
    }
  ];
}

/**
 * Example usage with LangChain:
 * 
 * ```typescript
 * import { ChatOpenAI } from '@langchain/openai';
 * import { ChatAnthropic } from '@langchain/anthropic';
 * import { DynamicStructuredTool } from '@langchain/core/tools';
 * import { getLangChainTools } from './adapters/langchain-adapter';
 * 
 * // Convert to LangChain tools
 * const tools = getLangChainTools().map(tool => 
 *   new DynamicStructuredTool({
 *     name: tool.name,
 *     description: tool.description,
 *     schema: z.object(tool.schema.properties), // Convert to Zod
 *     func: tool.func
 *   })
 * );
 * 
 * // Use with OpenAI
 * const openai = new ChatOpenAI({ model: 'gpt-4-turbo' });
 * const openaiWithTools = openai.bindTools(tools);
 * 
 * // Use with Anthropic
 * const anthropic = new ChatAnthropic({ model: 'claude-3-opus' });
 * const anthropicWithTools = anthropic.bindTools(tools);
 * 
 * // Use with any other LangChain-supported model!
 * ```
 */

export default getLangChainTools;
