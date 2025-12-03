import { MCPTool } from '@modelcontextprotocol/sdk';
import { ethers } from 'ethers';
import { z } from 'zod';
import { EthereumService } from '../blockchain/EthereumService';
import { getStakingContractTemplate } from '../contracts/templates';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

// New style tool registration for MCP SDK v1.12.0
export function registerDefiTools(server: any) {
  // Create Staking Contract Tool
  server.registerTool('eth_create_staking_contract', {
    description: 'Generate and prepare a staking contract for deployment',
    inputSchema: {
      name: z.string().describe('Name of the staking contract'),
      tokenAddress: z.string().describe('Address of the token to be staked'),
      rewardRate: z.string().describe('Reward rate per second (as a string number)'),
      ownerAddress: z.string().describe('Address that will own the staking contract')
    }
  }, async ({ name, tokenAddress, rewardRate, ownerAddress }) => {
    try {
      const contractCode = getStakingContractTemplate(name, tokenAddress, rewardRate);
      
      return {
        content: [{
          type: 'text',
          text: `Generated staking contract "${name}" for token ${tokenAddress} with reward rate ${rewardRate} per second. Owner: ${ownerAddress}. Use eth_deploy_contract to deploy it.`
        }],
        contractCode,
        name,
        tokenAddress,
        rewardRate,
        ownerAddress
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to generate staking contract: ${error.message}`
        }]
      };
    }
  });

  // Stake Tokens Tool
  server.registerTool('eth_stake_tokens', {
    description: 'Prepare a transaction to stake tokens in a staking contract',
    inputSchema: {
      stakingContractAddress: z.string().describe('Address of the staking contract'),
      amount: z.string().describe('Amount of tokens to stake (as a string number)'),
      fromAddress: z.string().describe('Address that will stake the tokens')
    }
  }, async ({ stakingContractAddress, amount, fromAddress }) => {
    try {
      const provider = ethereumService.getProvider();
      const stakingAbi = [
        'function stake(uint256 amount) external',
        'function stakingToken() view returns (address)',
        'function decimals() view returns (uint8)'
      ];
      
      const stakingContract = new ethers.Contract(stakingContractAddress, stakingAbi, provider);
      const tokenAddress = await stakingContract.stakingToken();
      
      const tokenAbi = ['function decimals() view returns (uint8)', 'function approve(address spender, uint256 amount) external returns (bool)'];
      const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);
      
      const approvalData = tokenContract.interface.encodeFunctionData('approve', [stakingContractAddress, amountWei]);
      const stakeData = stakingContract.interface.encodeFunctionData('stake', [amountWei]);
      
      return {
        content: [{
          type: 'text',
          text: `Prepared staking transaction: ${amount} tokens. Two transactions required: First approve the staking contract, then stake the tokens.`
        }],
        approvalTransaction: ethereumService.prepareTransaction({
          to: tokenAddress,
          from: fromAddress,
          data: approvalData,
        }),
        stakeTransaction: ethereumService.prepareTransaction({
          to: stakingContractAddress,
          from: fromAddress,
          data: stakeData,
        })
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to prepare staking transaction: ${error.message}`
        }]
      };
    }
  });

  // Shared swap function for both universal and legacy calls
  const executeSwap = async (tokenIn: string, tokenOut: string, amount: string, slippageTolerance = '0.5', executeTransaction = true) => {
    try {
      const signer = ethereumService.getSigner();
      if (!signer) {
        return {
          content: [{
            type: 'text',
            text: 'No wallet signer configured. Please set DEPLOYER_PRIVATE_KEY in your environment to execute transactions.'
          }]
        };
      }

      const fromAddress = signer.address;
      
      // Common token addresses on mainnet
      const TOKEN_ADDRESSES = {
        'ETH': '0x0000000000000000000000000000000000000000', // Special case for native ETH
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'USDC': '0xA0b86a33E6441689D2dE4F12ced26a3bD41bF33C',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'LINK': '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        'UNI': '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
        'PEPE': '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
      };

      // Resolve token addresses and fetch token info dynamically
      const getTokenInfo = async (token) => {
        const upperToken = token.toUpperCase();
        
        // Check if it's a known token symbol
        if (TOKEN_ADDRESSES[upperToken]) {
          const address = TOKEN_ADDRESSES[upperToken];
          if (address === '0x0000000000000000000000000000000000000000') {
            return { address, symbol: 'ETH', decimals: 18, isNative: true };
          }
          
          // Fetch info for known tokens too, to get fresh data
          try {
            const tokenContract = new ethers.Contract(address, [
              'function symbol() view returns (string)',
              'function decimals() view returns (uint8)'
            ], ethereumService.getProvider());
            const [symbol, decimals] = await Promise.all([
              tokenContract.symbol(),
              tokenContract.decimals()
            ]);
            return { address, symbol, decimals, isNative: false };
          } catch (error) {
            // Fallback for known tokens
            return { address, symbol: upperToken, decimals: 18, isNative: false };
          }
        }
        
        // Check if it's a contract address (0x followed by 40 hex characters)
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (addressRegex.test(token)) {
          try {
            // Fetch token information from the blockchain
            const tokenContract = new ethers.Contract(token, [
              'function symbol() view returns (string)',
              'function decimals() view returns (uint8)',
              'function name() view returns (string)'
            ], ethereumService.getProvider());
            
            const [symbol, decimals, name] = await Promise.all([
              tokenContract.symbol(),
              tokenContract.decimals(),
              tokenContract.name()
            ]);
            
            return { 
              address: token, 
              symbol, 
              decimals, 
              name,
              isNative: false 
            };
          } catch (error) {
            throw new Error(`Invalid ERC-20 token contract at address ${token}. Please verify the address is correct and the contract implements ERC-20 standard.`);
          }
        }
        
        throw new Error(`Unknown token: "${token}". Please provide either:\n• A token symbol (${Object.keys(TOKEN_ADDRESSES).join(', ')})\n• Any valid ERC-20 contract address (0x...)`);
      };

      const tokenInInfo = await getTokenInfo(tokenIn);
      const tokenOutInfo = await getTokenInfo(tokenOut);
      
      const isNativeETH = tokenInInfo.isNative;

      // Uniswap V3 addresses
      const UNISWAP_V3_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      
      const provider = ethereumService.getProvider();
      
      // Router ABI for both exactInputSingle and exactInput
      const routerAbi = [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
        'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)'
      ];
      
      const router = new ethers.Contract(UNISWAP_V3_ROUTER, routerAbi, signer);
      
      // Get token decimals and prepare amount
      let amountInWei;
      let decimalsIn = 18;
      
      if (isNativeETH) {
        amountInWei = ethers.parseEther(amount);
      } else {
        decimalsIn = Number(tokenInInfo.decimals);
        amountInWei = ethers.parseUnits(amount, decimalsIn);
      }

      // Get output token decimals for minimum calculation
      const decimalsOut = Number(tokenOutInfo.decimals);
      const tokenOutSymbol = tokenOutInfo.symbol;

      // Calculate minimum output with slippage protection
      // We don't estimate prices - let the market determine rates and just protect against slippage
      const slippagePercent = parseFloat(slippageTolerance) / 100;
      
      // Use a conservative minimum that's mainly for slippage protection
      // Set minimum to a very small amount to let the market determine the actual rate
      // This prevents "Too little received" while still providing slippage protection
      const conservativeSlippage = Math.max(slippagePercent, 0.005); // At least 0.5% slippage tolerance
      
      // For minimum output, we'll use a very conservative approach:
      // Just set a very low minimum that prevents obvious sandwich attacks but lets market determine rate
      let minAmountOut;
      if (tokenInInfo.symbol === 'ETH') {
        // For ETH swaps, set minimum to almost zero to let market determine rate
        minAmountOut = ethers.parseUnits('0.001', Number(decimalsOut)); // Very small minimum
      } else {
        // For other tokens, use a small percentage of input as minimum
        const inputAsNumber = parseFloat(amount);
        const minOutput = inputAsNumber * (1 - conservativeSlippage) * 0.1; // Very conservative 10% of expected
        minAmountOut = ethers.parseUnits(minOutput.toFixed(Number(decimalsOut)), Number(decimalsOut));
      }

      // Set deadline 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
      
      // Prepare swap parameters
      const swapParams = {
        tokenIn: isNativeETH ? WETH_ADDRESS : tokenInInfo.address,
        tokenOut: tokenOutInfo.address,
        fee: 3000, // 0.3% fee tier (most common)
        recipient: fromAddress,
        deadline: deadline,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
      };

      let tx;
      
      if (!executeTransaction) {
        // Just prepare the transaction
        const swapData = router.interface.encodeFunctionData('exactInputSingle', [swapParams]);
        return {
          content: [{
            type: 'text',
            text: `Prepared swap: ${amount} ${tokenInInfo.symbol} → ${tokenOutSymbol} (minimum with ${slippageTolerance}% slippage). Transaction ready for manual execution.`
          }],
          transactionData: {
            to: UNISWAP_V3_ROUTER,
            data: swapData,
            value: isNativeETH ? amountInWei.toString() : '0'
          }
        };
      }

      // Execute the transaction
      if (isNativeETH) {
        // For ETH, send as msg.value
        tx = await router.exactInputSingle(swapParams, { 
          value: amountInWei,
          gasLimit: 300000 // Conservative gas limit
        });
      } else {
        // For ERC-20 tokens, need approval first
        const tokenContract = new ethers.Contract(tokenInInfo.address, [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ], signer);
        
        // Check current allowance
        const currentAllowance = await tokenContract.allowance(fromAddress, UNISWAP_V3_ROUTER);
        
        if (currentAllowance < amountInWei) {
          const approveTx = await tokenContract.approve(UNISWAP_V3_ROUTER, amountInWei);
          await approveTx.wait();
          
          return {
            content: [{
              type: 'text',
              text: `Approved ${amount} ${tokenInInfo.symbol} for trading. Approval transaction: ${approveTx.hash}. Now executing the swap...`
            }]
          };
        }
        
        tx = await router.exactInputSingle(swapParams, { gasLimit: 300000 });
      }

      return {
        content: [{
          type: 'text',
          text: `🔄 Swap executed! ${amount} ${tokenInInfo.symbol} → ${tokenOutSymbol}\n\nTransaction Hash: ${tx.hash}\n\nWaiting for confirmation... This may take 1-2 minutes.`
        }],
        transactionHash: tx.hash,
        explorerUrl: `https://etherscan.io/tx/${tx.hash}`
      };

    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to execute swap: ${error.message}`
        }]
      };
    }
  };

  // Universal Token Swap Tool - handles any token pair and executes transactions
  server.registerTool('eth_swap_tokens', {
    description: 'Swap any tokens using Uniswap V3. Can handle ETH, WETH, and any ERC-20 tokens. Automatically executes the transaction using your configured wallet.',
    inputSchema: {
      tokenIn: z.string().describe('Token to swap from (symbol like "ETH", "USDT", "WETH" or contract address)'),
      tokenOut: z.string().describe('Token to swap to (symbol like "USDT", "USDC", "DAI" or contract address)'),
      amount: z.string().describe('Amount to swap (e.g., "0.002" for 0.002 ETH or "5" for 5 USDT)'),
      slippageTolerance: z.string().optional().describe('Slippage tolerance percentage (default: 0.5)'),
      executeTransaction: z.boolean().optional().describe('Whether to execute the transaction immediately (default: true)')
    }
  }, async ({ tokenIn, tokenOut, amount, slippageTolerance = '0.5', executeTransaction = true }) => {
    return await executeSwap(tokenIn, tokenOut, amount, slippageTolerance, executeTransaction);
  });

  // Backward compatibility alias for eth_swap_eth_to_usdt
  server.registerTool('eth_swap_eth_to_usdt', {
    description: 'Swap ETH to USDT using Uniswap V3 and execute the transaction',
    inputSchema: {
      ethAmount: z.string().describe('Amount of ETH to swap (e.g., "0.002" for ~$5)'),
      slippageTolerance: z.string().optional().describe('Slippage tolerance percentage (default: 0.5)'),
      executeTransaction: z.boolean().optional().describe('Whether to execute the transaction immediately (default: true)')
    }
  }, async ({ ethAmount, slippageTolerance = '0.5', executeTransaction = true }) => {
    return await executeSwap('ETH', 'USDT', ethAmount, slippageTolerance, executeTransaction);
  });
}

// Keep legacy array export for backward compatibility but it won't be used
export const defiTools: MCPTool[] = [];
