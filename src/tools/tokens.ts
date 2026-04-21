import { ethers } from 'ethers';
import { z } from 'zod';
import { EthereumService } from '../blockchain/EthereumService';
import { getERC20Template } from '../contracts/templates';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

// New-style tool registration for MCP SDK v1.12+ (Zod shape + MCP content result)
export function registerTokenTools(server: any) {
  // Create ERC-20 Token (generates Solidity only; deploy via eth_deploy_contract[_with_signer])
  server.registerTool('eth_create_token', {
    description: 'Generate a new ERC-20 token contract (Solidity). Deploy it afterwards with eth_compile_contract + eth_deploy_contract_with_signer.',
    annotations: {
      title: 'Create ERC-20 Token',
      readOnlyHint: true,
      openWorldHint: false
    },
    inputSchema: {
      name: z.string().describe('Name of the token'),
      symbol: z.string().describe('Symbol of the token (ticker)'),
      initialSupply: z.string().describe('Initial supply of the token (as a string number)'),
      decimals: z.number().int().min(0).max(36).optional().default(18).describe('Number of decimals for the token'),
      ownerAddress: z.string().describe('Ethereum address that will own the token contract')
    }
  }, async ({ name, symbol, initialSupply, decimals, ownerAddress }) => {
    try {
      const contractCode = getERC20Template(name, symbol, initialSupply, decimals ?? 18);
      return {
        content: [{
          type: 'text',
          text: `ERC-20 token contract generated for ${name} (${symbol}) with initial supply ${initialSupply} and ${decimals ?? 18} decimals. Owner: ${ownerAddress}.\n\n\`\`\`solidity\n${contractCode}\n\`\`\``
        }],
        structuredContent: {
          contractCode,
          name,
          symbol,
          initialSupply,
          decimals: decimals ?? 18,
          ownerAddress
        }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to generate ERC-20 contract: ${error.message}` }],
        isError: true
      };
    }
  });

  // Get ERC-20 Token Balance
  server.registerTool('eth_get_token_balance', {
    description: 'Get the balance of an ERC-20 token for a specific address, or the default signer wallet if no address is provided.',
    annotations: {
      title: 'Get ERC-20 Balance',
      readOnlyHint: true,
      openWorldHint: true
    },
    inputSchema: {
      tokenAddress: z.string().describe('Contract address of the ERC-20 token'),
      walletAddress: z.string().optional().describe('Ethereum address to check the balance for (optional; defaults to configured signer wallet)')
    }
  }, async ({ tokenAddress, walletAddress }) => {
    try {
      const resolvedAddress = walletAddress || ethereumService.getSigner()?.address;
      if (!resolvedAddress) {
        throw new Error('No wallet address provided and no default signer available. Please provide walletAddress or set DEPLOYER_PRIVATE_KEY.');
      }
      const balance = await ethereumService.getTokenBalance(tokenAddress, resolvedAddress);
      const isDefaultWallet = !walletAddress;
      return {
        content: [{
          type: 'text',
          text: `${isDefaultWallet ? 'Your wallet' : `Address ${resolvedAddress}`} has ${balance} (token: ${tokenAddress})`
        }],
        structuredContent: {
          balance,
          walletAddress: resolvedAddress,
          tokenAddress,
          isDefaultWallet
        }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to get token balance: ${error.message}` }],
        isError: true
      };
    }
  });

  // Transfer ERC-20 Tokens (prepare OR execute)
  server.registerTool('eth_transfer_token', {
    description: 'Transfer ERC-20 tokens. By default executes the transaction using the configured signer. Set executeTransaction=false to only prepare an unsigned transaction for an external wallet.',
    annotations: {
      title: 'Transfer ERC-20 Tokens',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      tokenAddress: z.string().describe('Contract address of the ERC-20 token'),
      toAddress: z.string().describe('Ethereum address receiving the tokens'),
      amount: z.string().describe('Amount of tokens to transfer (human-readable, e.g. "1.5")'),
      fromAddress: z.string().optional().describe('Sender address (optional; defaults to signer). Required when executeTransaction=false.'),
      executeTransaction: z.boolean().optional().default(true).describe('If true (default), signs and sends using DEPLOYER_PRIVATE_KEY. If false, returns an unsigned transaction.')
    }
  }, async ({ tokenAddress, toAddress, amount, fromAddress, executeTransaction = true }) => {
    try {
      const signer = ethereumService.getSigner();
      const provider = ethereumService.getProvider();
      const abi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      if (executeTransaction) {
        if (!signer) {
          throw new Error('No signer configured. Set DEPLOYER_PRIVATE_KEY or use executeTransaction=false.');
        }
        const tokenContract = new ethers.Contract(tokenAddress, abi, signer);
        const [decimals, symbol] = await Promise.all([tokenContract.decimals(), tokenContract.symbol().catch(() => '')]);
        const amountWei = ethers.parseUnits(amount, decimals);
        const tx = await tokenContract.transfer(toAddress, amountWei);
        return {
          content: [{
            type: 'text',
            text: `Transfer submitted: ${amount} ${symbol || 'tokens'} → ${toAddress}\nTx: ${tx.hash}\nhttps://etherscan.io/tx/${tx.hash}`
          }],
          structuredContent: {
            transactionHash: tx.hash,
            from: signer.address,
            to: toAddress,
            tokenAddress,
            amount,
            explorerUrl: `https://etherscan.io/tx/${tx.hash}`
          }
        };
      }

      const sender = fromAddress || signer?.address;
      if (!sender) {
        throw new Error('fromAddress is required when executeTransaction=false and no signer is configured.');
      }
      const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      const data = tokenContract.interface.encodeFunctionData('transfer', [toAddress, amountWei]);
      const gasLimit = await ethereumService.estimateGas({ to: tokenAddress, from: sender, data });
      const prepared = ethereumService.prepareTransaction({ to: tokenAddress, from: sender, data, gasLimit });
      return {
        content: [{
          type: 'text',
          text: `Prepared unsigned transfer of ${amount} tokens from ${sender} to ${toAddress}. Sign and broadcast with your wallet.`
        }],
        structuredContent: { transaction: prepared }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to transfer tokens: ${error.message}` }],
        isError: true
      };
    }
  });
}
