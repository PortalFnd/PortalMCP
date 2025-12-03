import { ethers } from 'ethers';
import { z } from 'zod';
import { EthereumService } from '../blockchain/EthereumService';

const ethereumService = new EthereumService('mainnet');

// New style tool registration for MCP SDK v1.12.0
export function registerGeneralTools(server: any) {
  // ETH Balance Tool
  server.registerTool('eth_get_balance', {
    description: 'Get ETH balance for an Ethereum address or the default signer wallet',
    inputSchema: {
      address: z.string().optional().describe('Ethereum address to check balance for (optional if using default wallet)')
    }
  }, async ({ address }) => {
    try {
      const resolvedAddress = address || ethereumService.getSigner()?.address;
      if (!resolvedAddress) {
        throw new Error("No address provided and no default signer available. Please provide an address or set DEPLOYER_PRIVATE_KEY in your environment.");
      }

      const balance = await ethereumService.getBalance(resolvedAddress);
      const isDefaultWallet = !address && ethereumService.getSigner()?.address === resolvedAddress;
      
      return {
        content: [{
          type: 'text',
          text: `${isDefaultWallet ? 'Your wallet' : `Address ${resolvedAddress}`} has ${balance} ETH on ${ethereumService.getNetwork()}`
        }],
        structuredContent: {
          balance,
          address: resolvedAddress,
          network: ethereumService.getNetwork(),
          isDefaultWallet
        }
      };
    } catch (error) {
      console.error('Error getting ETH balance:', error);
      throw error;
    }
  });

  // Call Contract Tool
  server.registerTool('eth_call_contract', {
    description: 'Call a read-only function on an Ethereum smart contract',
    inputSchema: {
      contractAddress: z.string().describe('Address of the contract to call'),
      functionName: z.string().describe('Name of the function to call'),
      functionArgs: z.array(z.any()).optional().describe('Arguments to pass to the function'),
      abi: z.array(z.any()).describe('ABI for the contract function')
    }
  }, async ({ contractAddress, functionName, functionArgs, abi }) => {
    try {
      const provider = ethereumService.getProvider();
      const contract = new ethers.Contract(contractAddress, abi, provider);
      
      if (!contract[functionName]) {
        throw new Error(`Function ${functionName} not found in contract ABI`);
      }
      
      const args = functionArgs || [];
      const result = await contract[functionName](...args);
      
      // Format result based on type
      let formattedResult;
      if (typeof result === 'bigint' || (typeof result === 'object' && result !== null && typeof result.toBigInt === 'function')) {
        // Handle BigNumber and bigint types in ethers v6
        formattedResult = result.toString();
      } else if (Array.isArray(result)) {
        formattedResult = result.map(item => 
          (typeof item === 'bigint' || (typeof item === 'object' && item !== null && typeof item.toBigInt === 'function')) 
            ? item.toString() 
            : item
        );
      } else {
        formattedResult = result;
      }
      
      return {
        content: [{
          type: 'text',
          text: `Contract call result: ${JSON.stringify(formattedResult)}`
        }],
        structuredContent: { 
          result: formattedResult,
          contractAddress,
          functionName,
          network: ethereumService.getNetwork()
        }
      };
    } catch (error) {
      console.error('Error calling contract:', error);
      throw error;
    }
  });

  // Send Transaction Tool
  server.registerTool('eth_send_transaction', {
    description: 'Prepare a generic transaction to be signed by the user\'s wallet',
    inputSchema: {
      to: z.string().describe('Recipient address of the transaction'),
      from: z.string().describe('Sender address of the transaction'),
      value: z.string().optional().describe('Amount of ETH to send in the transaction (in ETH, not wei)'),
      data: z.string().optional().default('0x').describe('Hex data to include in the transaction')
    }
  }, async ({ to, from, value, data }) => {
    try {
      // Convert ETH value to wei if provided
      const valueWei = value ? ethers.parseEther(value) : undefined;
      
      // Prepare transaction object
      const transactionRequest = {
        to,
        from,
        value: valueWei,
        data: data || '0x',
      };
      
      // Estimate gas
      const gasLimit = await ethereumService.estimateGas(transactionRequest);
      
      // Create a new transaction request with gasLimit included
      const fullTransactionRequest = {
        ...transactionRequest,
        gasLimit
      };
      
      const preparedTransaction = ethereumService.prepareTransaction(fullTransactionRequest);
      
      return {
        content: [{
          type: 'text',
          text: `Transaction prepared from ${from} to ${to}${value ? ` with ${value} ETH` : ''}. The user needs to sign this transaction with their wallet.`
        }],
        structuredContent: {
          transaction: preparedTransaction
        }
      };
    } catch (error) {
      console.error('Error preparing transaction:', error);
      throw error;
    }
  });
}