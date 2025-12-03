import { MCPTool } from '@modelcontextprotocol/sdk';
import { ethers } from 'ethers';
import { EthereumService } from '../blockchain/EthereumService';
import { getERC20Template } from '../contracts/templates';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

export const tokenTools: MCPTool[] = [
  {
    name: 'eth_create_token',
    description: 'Create a new ERC-20 token with customizable properties',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the token' },
        symbol: { type: 'string', description: 'Symbol of the token (ticker)' },
        initialSupply: { type: 'string', description: 'Initial supply of the token (as a string number)' },
        decimals: { type: 'number', description: 'Number of decimals for the token', default: 18 },
        ownerAddress: { type: 'string', description: 'Ethereum address that will own the token contract' },
      },
      required: ['name', 'symbol', 'initialSupply', 'ownerAddress']
    },
    async handler({ name, symbol, initialSupply, decimals, ownerAddress }) {
      // Generate the contract code
      const contractCode = getERC20Template(name, symbol, initialSupply, decimals);
      
      // Return data needed for deployment
      return {
        contractCode,
        name,
        symbol,
        initialSupply,
        decimals,
        ownerAddress,
        message: 'ERC-20 token contract generated. Review the code and use eth_deploy_contract to deploy it.'
      };
    }
  },
  
  {
    name: 'eth_get_token_balance',
    description: 'Get the balance of an ERC-20 token for a specific address or the default signer wallet',
    parameters: {
      type: 'object',
      properties: {
        tokenAddress: { type: 'string', description: 'Contract address of the ERC-20 token' },
        walletAddress: { type: 'string', description: 'Ethereum address to check the balance for (optional if using default wallet)' },
      },
      required: ['tokenAddress']
    },
    async handler({ tokenAddress, walletAddress }) {
      try {
        const resolvedAddress = walletAddress || ethereumService.getSigner()?.address;
        if (!resolvedAddress) {
          return { error: "No wallet address provided and no default signer available. Please provide a wallet address or set DEPLOYER_PRIVATE_KEY in your environment." };
        }

        const balance = await ethereumService.getTokenBalance(tokenAddress, resolvedAddress);
        const isDefaultWallet = !walletAddress && ethereumService.getSigner()?.address === resolvedAddress;
        
        return { 
          balance, 
          walletAddress: resolvedAddress, 
          tokenAddress,
          isDefaultWallet,
          message: `${isDefaultWallet ? 'Your wallet' : `Address ${resolvedAddress}`} has ${balance}`
        };
      } catch (error) {
        return { error: `Failed to get token balance: ${error.message}` };
      }
    }
  },
  
  {
    name: 'eth_transfer_token',
    description: 'Prepare a transaction to transfer ERC-20 tokens',
    parameters: {
      type: 'object',
      properties: {
        tokenAddress: { type: 'string', description: 'Contract address of the ERC-20 token' },
        fromAddress: { type: 'string', description: 'Ethereum address sending the tokens' },
        toAddress: { type: 'string', description: 'Ethereum address receiving the tokens' },
        amount: { type: 'string', description: 'Amount of tokens to transfer (as a string number)' },
      },
      required: ['tokenAddress', 'fromAddress', 'toAddress', 'amount']
    },
    async handler({ tokenAddress, fromAddress, toAddress, amount }) {
      try {
        const provider = ethereumService.getProvider();
        const abi = [
          'function transfer(address to, uint amount) returns (bool)',
          'function decimals() view returns (uint8)',
        ];
        
        const tokenContract = new ethers.Contract(tokenAddress, abi, provider);
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(amount, decimals);
        
        // Create unsigned transaction
        const data = tokenContract.interface.encodeFunctionData('transfer', [toAddress, amountWei]);
        const gasLimit = await ethereumService.estimateGas({
          to: tokenAddress,
          from: fromAddress,
          data,
        });
        
        const transaction = {
          to: tokenAddress,
          from: fromAddress,
          data,
          gasLimit,
        };
        
        return {
          transaction: ethereumService.prepareTransaction(transaction),
          message: `Transaction prepared to transfer ${amount} tokens from ${fromAddress} to ${toAddress}. The user needs to sign this transaction with their wallet.`
        };
      } catch (error) {
        return { error: `Failed to prepare token transfer: ${error.message}` };
      }
    }
  }
];
