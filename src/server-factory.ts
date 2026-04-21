import dotenv from 'dotenv';
import { z } from 'zod';
import { ethers } from 'ethers';

// Load env before any module reads process.env
dotenv.config();

// SDK is CJS-unfriendly in places; require dynamically to sidestep
// typesVersions quirks and keep this file compatible with tsconfig.
const {
  McpServer,
  ResourceTemplate
} = require('@modelcontextprotocol/sdk/server/mcp.js');

import { registerTokenTools } from './tools/tokens';
import { registerNftTools } from './tools/nfts';
import { registerDefiTools } from './tools/defi';
import { registerGeneralTools } from './tools/general';
import { registerContractTools } from './tools/contracts';
import { EthereumService } from './blockchain/EthereumService';

export interface PortalServerOptions {
  name?: string;
  version?: string;
  network?: string;
}

/**
 * Build a fully-configured PortalMCP `McpServer` instance.
 * Shared by both the stdio entrypoint and the Streamable HTTP entrypoint so
 * every transport exposes identical tools, resources, and prompts.
 */
export function createPortalServer(opts: PortalServerOptions = {}) {
  const network = opts.network || process.env.ETHEREUM_NETWORK || 'mainnet';

  const server = new McpServer({
    name: opts.name || 'PortalMCP',
    version: opts.version || '1.2.0',
    description: 'PortalMCP - Universal AI gateway to Ethereum (tools, resources, prompts)'
  });

  // Minimal shim so tool modules written against our old wrapper keep working.
  const shim = {
    registerTool: (name: string, config: any, handler: any) => server.registerTool(name, config, handler)
  };

  registerGeneralTools(shim);
  registerContractTools(shim);
  registerDefiTools(shim);
  registerTokenTools(shim);
  registerNftTools(shim);

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------
  const walletService = new EthereumService(network);

  server.resource(
    'wallet',
    'eth://wallet',
    {
      description: 'Current PortalMCP signer address, network, and ETH balance',
      mimeType: 'application/json'
    },
    async (uri: URL) => {
      const signer = walletService.getSigner();
      const payload: any = {
        network: walletService.getNetwork(),
        signerConfigured: !!signer
      };
      if (signer) {
        payload.address = signer.address;
        try {
          payload.balanceEth = await walletService.getBalance(signer.address);
        } catch (e: any) {
          payload.balanceError = e.message;
        }
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2)
        }]
      };
    }
  );

  server.resource(
    'balance',
    new ResourceTemplate('eth://balance/{address}', { list: undefined }),
    {
      description: 'Live ETH balance for any address on the configured network',
      mimeType: 'application/json'
    },
    async (uri: URL, variables: { address: string }) => {
      const address = variables.address;
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid Ethereum address: ${address}`);
      }
      const balance = await walletService.getBalance(address);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ address, balanceEth: balance, network: walletService.getNetwork() }, null, 2)
        }]
      };
    }
  );

  server.resource(
    'transaction',
    new ResourceTemplate('eth://tx/{hash}', { list: undefined }),
    {
      description: 'Transaction details and receipt for a given tx hash',
      mimeType: 'application/json'
    },
    async (uri: URL, variables: { hash: string }) => {
      const hash = variables.hash;
      if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
        throw new Error(`Invalid transaction hash: ${hash}`);
      }
      const provider = walletService.getProvider();
      const [tx, receipt] = await Promise.all([
        provider.getTransaction(hash),
        provider.getTransactionReceipt(hash)
      ]);
      const payload: any = {
        hash,
        network: walletService.getNetwork(),
        explorerUrl: `https://etherscan.io/tx/${hash}`,
        found: !!tx
      };
      if (tx) {
        payload.transaction = {
          from: tx.from,
          to: tx.to,
          valueEth: ethers.formatEther(tx.value ?? 0n),
          nonce: tx.nonce,
          blockNumber: tx.blockNumber,
          chainId: tx.chainId?.toString()
        };
      }
      if (receipt) {
        payload.receipt = {
          status: receipt.status === 1 ? 'success' : 'failed',
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPriceGwei: receipt.gasPrice ? ethers.formatUnits(receipt.gasPrice, 'gwei') : null,
          logsCount: receipt.logs.length
        };
      }
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2)
        }]
      };
    }
  );

  server.resource(
    'token',
    new ResourceTemplate('eth://token/{address}', { list: undefined }),
    {
      description: 'ERC-20 token metadata: name, symbol, decimals, total supply',
      mimeType: 'application/json'
    },
    async (uri: URL, variables: { address: string }) => {
      const address = variables.address;
      if (!ethers.isAddress(address)) {
        throw new Error(`Invalid token address: ${address}`);
      }
      const provider = walletService.getProvider();
      const abi = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)'
      ];
      const c = new ethers.Contract(address, abi, provider);
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        c.name().catch(() => null),
        c.symbol().catch(() => null),
        c.decimals().catch(() => null),
        c.totalSupply().catch(() => null)
      ]);
      const payload = {
        address,
        name,
        symbol,
        decimals: decimals !== null ? Number(decimals) : null,
        totalSupply: totalSupply !== null && decimals !== null
          ? ethers.formatUnits(totalSupply, decimals)
          : null,
        network: walletService.getNetwork()
      };
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(payload, null, 2)
        }]
      };
    }
  );

  // -------------------------------------------------------------------------
  // Prompts
  // -------------------------------------------------------------------------
  server.prompt(
    'swap_tokens',
    'Guided prompt to swap tokens via the eth_swap_tokens tool.',
    {
      tokenIn: z.string().describe('Input token (symbol or 0x address)'),
      tokenOut: z.string().describe('Output token (symbol or 0x address)'),
      amount: z.string().describe('Amount of tokenIn to swap')
    },
    ({ tokenIn, tokenOut, amount }: { tokenIn: string; tokenOut: string; amount: string }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Swap ${amount} ${tokenIn} for ${tokenOut} using the eth_swap_tokens tool. Use a slippage tolerance of 0.5% unless I say otherwise. Before executing, tell me the wallet address (via the eth://wallet resource) and confirm the transaction.`
        }
      }]
    })
  );

  server.prompt(
    'deploy_erc20',
    'Generate, compile, and deploy an ERC-20 token end-to-end.',
    {
      name: z.string().describe('Token name'),
      symbol: z.string().describe('Token ticker'),
      initialSupply: z.string().describe('Initial supply (human-readable)')
    },
    ({ name, symbol, initialSupply }: { name: string; symbol: string; initialSupply: string }) => ({
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `Use PortalMCP to deploy an ERC-20 called "${name}" (${symbol}) with initial supply ${initialSupply}. Steps: (1) eth_create_token to generate Solidity, (2) eth_compile_contract, (3) eth_deploy_contract_with_signer. After deployment report the contract address and Etherscan link.`
        }
      }]
    })
  );

  return server;
}
