/**
 * REST API Adapter for PortalMCP
 * 
 * Exposes PortalMCP tools as HTTP endpoints
 * Can be used with ANY AI system that supports HTTP calls:
 * - ChatGPT Custom GPTs (Actions)
 * - Google Gemini
 * - Any custom AI application
 * - Webhooks and automation tools
 */

import { ethers } from 'ethers';
import { EthereumService } from '../blockchain/EthereumService';
import { compileSolidity } from '../blockchain/CompilerService';
import { generateContractWithClaude } from '../claude/ContractGenerator';
import { getERC20Template, getERC721Template, getStakingContractTemplate } from '../contracts/templates';

/**
 * OpenAPI 3.0 Specification for PortalMCP
 * Use this with ChatGPT Custom GPTs or any OpenAPI-compatible system
 */
export const openAPISpec = {
  openapi: '3.0.0',
  info: {
    title: 'PortalMCP - Ethereum Gateway API',
    version: '1.0.0',
    description: 'REST API for Ethereum blockchain interactions. Supports balance checks, token operations, NFTs, DeFi swaps, and smart contract deployment.'
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Local development' },
    { url: 'https://your-domain.com/api', description: 'Production' }
  ],
  paths: {
    '/eth/balance/{address}': {
      get: {
        operationId: 'getEthBalance',
        summary: 'Get ETH balance for an address',
        parameters: [
          { name: 'address', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': {
            description: 'Balance retrieved',
            content: { 'application/json': { schema: { type: 'object' } } }
          }
        }
      }
    },
    '/eth/balance': {
      get: {
        operationId: 'getDefaultWalletBalance',
        summary: 'Get ETH balance for the configured wallet',
        responses: {
          '200': { description: 'Balance retrieved' }
        }
      }
    },
    '/token/balance': {
      get: {
        operationId: 'getTokenBalance',
        summary: 'Get ERC-20 token balance',
        parameters: [
          { name: 'tokenAddress', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'walletAddress', in: 'query', required: false, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Token balance retrieved' } }
      }
    },
    '/token/create': {
      post: {
        operationId: 'createToken',
        summary: 'Generate ERC-20 token contract code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  symbol: { type: 'string' },
                  initialSupply: { type: 'string' },
                  decimals: { type: 'number', default: 18 }
                },
                required: ['name', 'symbol', 'initialSupply']
              }
            }
          }
        },
        responses: { '200': { description: 'Token contract generated' } }
      }
    },
    '/token/transfer': {
      post: {
        operationId: 'transferToken',
        summary: 'Transfer ERC-20 tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tokenAddress: { type: 'string' },
                  toAddress: { type: 'string' },
                  amount: { type: 'string' }
                },
                required: ['tokenAddress', 'toAddress', 'amount']
              }
            }
          }
        },
        responses: { '200': { description: 'Transfer prepared/executed' } }
      }
    },
    '/swap': {
      post: {
        operationId: 'swapTokens',
        summary: 'Swap tokens on Uniswap V3',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tokenIn: { type: 'string', description: 'Token symbol or address' },
                  tokenOut: { type: 'string', description: 'Token symbol or address' },
                  amount: { type: 'string' },
                  slippageTolerance: { type: 'string', default: '0.5' }
                },
                required: ['tokenIn', 'tokenOut', 'amount']
              }
            }
          }
        },
        responses: { '200': { description: 'Swap executed' } }
      }
    },
    '/nft/collection': {
      post: {
        operationId: 'createNFTCollection',
        summary: 'Generate NFT collection contract (ERC-721)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  symbol: { type: 'string' },
                  baseURI: { type: 'string' }
                },
                required: ['name', 'symbol']
              }
            }
          }
        },
        responses: { '200': { description: 'NFT contract generated' } }
      }
    },
    '/nft/mint': {
      post: {
        operationId: 'mintNFT',
        summary: 'Mint an NFT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  contractAddress: { type: 'string' },
                  toAddress: { type: 'string' },
                  tokenId: { type: 'string' },
                  tokenURI: { type: 'string' }
                },
                required: ['contractAddress', 'toAddress']
              }
            }
          }
        },
        responses: { '200': { description: 'NFT minted' } }
      }
    },
    '/nft/owner/{contractAddress}/{tokenId}': {
      get: {
        operationId: 'getNFTOwner',
        summary: 'Get owner of an NFT',
        parameters: [
          { name: 'contractAddress', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'tokenId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Owner address returned' } }
      }
    },
    '/contract/generate': {
      post: {
        operationId: 'generateContract',
        summary: 'Generate Solidity contract using AI',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  contractType: { type: 'string' },
                  additionalFeatures: { type: 'array', items: { type: 'string' } }
                },
                required: ['description']
              }
            }
          }
        },
        responses: { '200': { description: 'Contract code generated' } }
      }
    },
    '/contract/compile': {
      post: {
        operationId: 'compileContract',
        summary: 'Compile Solidity to bytecode',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  contractCode: { type: 'string' },
                  contractName: { type: 'string' }
                },
                required: ['contractCode', 'contractName']
              }
            }
          }
        },
        responses: { '200': { description: 'Compiled bytecode and ABI' } }
      }
    },
    '/contract/deploy': {
      post: {
        operationId: 'deployContract',
        summary: 'Deploy a compiled contract',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  bytecode: { type: 'string' },
                  abi: { type: 'array' },
                  constructorArgs: { type: 'array' }
                },
                required: ['bytecode', 'abi']
              }
            }
          }
        },
        responses: { '200': { description: 'Contract deployed' } }
      }
    }
  }
};

/**
 * Express.js route handlers
 * Use with: app.use('/api', createPortalMCPRouter())
 */
export function createExpressRoutes() {
  // This would be implemented with Express.js
  // For now, return the route definitions
  return {
    routes: Object.keys(openAPISpec.paths),
    spec: openAPISpec
  };
}

/**
 * Standalone HTTP server for PortalMCP REST API
 * Run with: npx ts-node src/adapters/rest-api.ts
 */
export async function startRESTServer(port = 3001) {
  // Dynamic import to avoid requiring express as a dependency
  const http = await import('http');
  const url = await import('url');
  
  const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);
  
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url || '', true);
    const path = parsedUrl.pathname || '';
    const query = parsedUrl.query;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      // OpenAPI spec endpoint
      if (path === '/openapi.json') {
        res.writeHead(200);
        res.end(JSON.stringify(openAPISpec, null, 2));
        return;
      }
      
      // Health check
      if (path === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', network: ethereumService.getNetwork() }));
        return;
      }
      
      // GET /eth/balance/:address
      if (path.startsWith('/eth/balance')) {
        const address = path.split('/')[3] || ethereumService.getSigner()?.address;
        if (!address) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No address provided' }));
          return;
        }
        const balance = await ethereumService.getBalance(address);
        res.writeHead(200);
        res.end(JSON.stringify({ balance: `${balance} ETH`, address, network: ethereumService.getNetwork() }));
        return;
      }
      
      // GET /token/balance
      if (path === '/token/balance' && req.method === 'GET') {
        const tokenAddress = query.tokenAddress as string;
        const walletAddress = (query.walletAddress as string) || ethereumService.getSigner()?.address;
        if (!tokenAddress || !walletAddress) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'tokenAddress and walletAddress required' }));
          return;
        }
        const balance = await ethereumService.getTokenBalance(tokenAddress, walletAddress);
        res.writeHead(200);
        res.end(JSON.stringify({ balance, tokenAddress, walletAddress }));
        return;
      }
      
      // POST endpoints - parse body
      if (req.method === 'POST') {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        const data = JSON.parse(body || '{}');
        
        // POST /token/create
        if (path === '/token/create') {
          const code = getERC20Template(data.name, data.symbol, data.initialSupply, data.decimals || 18);
          res.writeHead(200);
          res.end(JSON.stringify({ contractCode: code, ...data }));
          return;
        }
        
        // POST /nft/collection
        if (path === '/nft/collection') {
          const code = getERC721Template(data.name, data.symbol, data.baseURI || '');
          res.writeHead(200);
          res.end(JSON.stringify({ contractCode: code, ...data }));
          return;
        }
        
        // POST /contract/compile
        if (path === '/contract/compile') {
          const compiled = await compileSolidity(data.contractCode, data.contractName);
          res.writeHead(200);
          res.end(JSON.stringify(compiled));
          return;
        }
        
        // POST /contract/generate
        if (path === '/contract/generate') {
          const code = await generateContractWithClaude(data.description, data.contractType, data.additionalFeatures);
          res.writeHead(200);
          res.end(JSON.stringify({ contractCode: code }));
          return;
        }
      }
      
      // 404 for unknown routes
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found', availableRoutes: Object.keys(openAPISpec.paths) }));
      
    } catch (error: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  
  server.listen(port, () => {
    console.log(`PortalMCP REST API running on http://localhost:${port}`);
    console.log(`OpenAPI spec available at http://localhost:${port}/openapi.json`);
  });
  
  return server;
}

// Run server if this file is executed directly
if (require.main === module) {
  startRESTServer(parseInt(process.env.PORT || '3001'));
}
