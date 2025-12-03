/**
 * OpenAI Adapter for PortalMCP
 * 
 * Converts PortalMCP tools to OpenAI function calling format
 * for use with OpenAI Assistants API or Chat Completions
 */

import { ethers } from 'ethers';
import { EthereumService } from '../blockchain/EthereumService';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

// OpenAI Function Definition type
export interface OpenAIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// OpenAI Tool type (for Assistants API)
export interface OpenAITool {
  type: 'function';
  function: OpenAIFunction;
}

/**
 * All PortalMCP tools converted to OpenAI function format
 */
export const openAITools: OpenAITool[] = [
  // General Tools
  {
    type: 'function',
    function: {
      name: 'eth_get_balance',
      description: 'Get ETH balance for an Ethereum address',
      parameters: {
        type: 'object',
        properties: {
          address: { 
            type: 'string', 
            description: 'Ethereum address to check balance for (optional if using default wallet)' 
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_get_token_balance',
      description: 'Get the balance of an ERC-20 token for a specific address',
      parameters: {
        type: 'object',
        properties: {
          tokenAddress: { type: 'string', description: 'Contract address of the ERC-20 token' },
          walletAddress: { type: 'string', description: 'Ethereum address to check balance for' }
        },
        required: ['tokenAddress']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_swap_tokens',
      description: 'Swap tokens using Uniswap V3. Supports ETH, WETH, USDT, USDC, DAI, LINK, UNI, PEPE or any ERC-20 address',
      parameters: {
        type: 'object',
        properties: {
          tokenIn: { type: 'string', description: 'Token to swap from (symbol or address)' },
          tokenOut: { type: 'string', description: 'Token to swap to (symbol or address)' },
          amount: { type: 'string', description: 'Amount to swap (e.g., "0.01" for 0.01 ETH)' },
          slippageTolerance: { type: 'string', description: 'Slippage tolerance percentage (default: 0.5)' }
        },
        required: ['tokenIn', 'tokenOut', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_transfer_token',
      description: 'Transfer ERC-20 tokens to another address',
      parameters: {
        type: 'object',
        properties: {
          tokenAddress: { type: 'string', description: 'Contract address of the ERC-20 token' },
          toAddress: { type: 'string', description: 'Recipient address' },
          amount: { type: 'string', description: 'Amount to transfer' }
        },
        required: ['tokenAddress', 'toAddress', 'amount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_create_token',
      description: 'Create a new ERC-20 token',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the token' },
          symbol: { type: 'string', description: 'Symbol/ticker of the token' },
          initialSupply: { type: 'string', description: 'Initial supply of tokens' },
          decimals: { type: 'number', description: 'Number of decimals (default: 18)' }
        },
        required: ['name', 'symbol', 'initialSupply']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_create_nft_collection',
      description: 'Create a new NFT collection (ERC-721)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the NFT collection' },
          symbol: { type: 'string', description: 'Symbol for the collection' },
          baseURI: { type: 'string', description: 'Base URI for token metadata' }
        },
        required: ['name', 'symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_mint_nft',
      description: 'Mint an NFT from an existing collection',
      parameters: {
        type: 'object',
        properties: {
          contractAddress: { type: 'string', description: 'NFT contract address' },
          toAddress: { type: 'string', description: 'Address to mint to' },
          tokenId: { type: 'string', description: 'Token ID to mint' },
          tokenURI: { type: 'string', description: 'URI for token metadata' }
        },
        required: ['contractAddress', 'toAddress']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_get_nft_owner',
      description: 'Get the owner of a specific NFT',
      parameters: {
        type: 'object',
        properties: {
          contractAddress: { type: 'string', description: 'NFT contract address' },
          tokenId: { type: 'string', description: 'Token ID to check' }
        },
        required: ['contractAddress', 'tokenId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_generate_contract',
      description: 'Generate Solidity smart contract code based on description',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Description of the contract functionality' },
          contractType: { type: 'string', description: 'Type of contract (ERC20, ERC721, Custom)' },
          additionalFeatures: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Additional features to include' 
          }
        },
        required: ['description']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_compile_contract',
      description: 'Compile Solidity code to bytecode and ABI',
      parameters: {
        type: 'object',
        properties: {
          contractCode: { type: 'string', description: 'Solidity source code' },
          contractName: { type: 'string', description: 'Name of the contract' }
        },
        required: ['contractCode', 'contractName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'eth_call_contract',
      description: 'Call a read-only function on a smart contract',
      parameters: {
        type: 'object',
        properties: {
          contractAddress: { type: 'string', description: 'Contract address' },
          functionName: { type: 'string', description: 'Function name to call' },
          functionArgs: { type: 'array', description: 'Arguments for the function' },
          abi: { type: 'array', description: 'Contract ABI' }
        },
        required: ['contractAddress', 'functionName', 'abi']
      }
    }
  }
];

/**
 * Get tools in OpenAI format for use with Assistants API
 */
export function getOpenAITools(): OpenAITool[] {
  return openAITools;
}

/**
 * Get just the function definitions for Chat Completions API
 */
export function getOpenAIFunctions(): OpenAIFunction[] {
  return openAITools.map(tool => tool.function);
}

/**
 * Execute a tool call from OpenAI and return the result
 * This is the handler that processes function calls from OpenAI
 */
export async function executeOpenAIToolCall(
  functionName: string, 
  args: Record<string, any>
): Promise<string> {
  try {
    switch (functionName) {
      case 'eth_get_balance': {
        const address = args.address || ethereumService.getSigner()?.address;
        if (!address) {
          return JSON.stringify({ error: 'No address provided and no default wallet configured' });
        }
        const balance = await ethereumService.getBalance(address);
        return JSON.stringify({ 
          balance: `${balance} ETH`, 
          address, 
          network: ethereumService.getNetwork() 
        });
      }

      case 'eth_get_token_balance': {
        const walletAddress = args.walletAddress || ethereumService.getSigner()?.address;
        if (!walletAddress) {
          return JSON.stringify({ error: 'No wallet address provided' });
        }
        const balance = await ethereumService.getTokenBalance(args.tokenAddress, walletAddress);
        return JSON.stringify({ balance, walletAddress, tokenAddress: args.tokenAddress });
      }

      case 'eth_swap_tokens': {
        // Swap execution requires the full MCP server context
        // This adapter provides the interface; actual execution happens via MCP
        return JSON.stringify({ 
          message: `Swap prepared: ${args.amount} ${args.tokenIn} → ${args.tokenOut}`,
          note: 'For actual execution, use the MCP server with a configured wallet',
          params: args 
        });
      }

      // Add more cases for other tools...
      
      default:
        return JSON.stringify({ error: `Unknown function: ${functionName}` });
    }
  } catch (error: any) {
    return JSON.stringify({ error: error.message });
  }
}

/**
 * Example: How to use with OpenAI Chat Completions API
 * 
 * ```typescript
 * import OpenAI from 'openai';
 * import { getOpenAIFunctions, executeOpenAIToolCall } from './adapters/openai-adapter';
 * 
 * const openai = new OpenAI();
 * 
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4-turbo',
 *   messages: [{ role: 'user', content: 'What is my ETH balance?' }],
 *   functions: getOpenAIFunctions(),
 *   function_call: 'auto'
 * });
 * 
 * if (response.choices[0].message.function_call) {
 *   const { name, arguments: args } = response.choices[0].message.function_call;
 *   const result = await executeOpenAIToolCall(name, JSON.parse(args));
 *   console.log(result);
 * }
 * ```
 */
