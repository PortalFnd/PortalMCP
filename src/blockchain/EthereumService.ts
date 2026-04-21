import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

// Strip placeholder / empty env values so they don't masquerade as real keys.
const PLACEHOLDER_PATTERN = /^(your_|replace_|xxx|changeme|example|<|placeholder)/i;
function cleanKey(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

// Map ethers network name → modern Alchemy subdomain.
const ALCHEMY_SUBDOMAIN: Record<string, string> = {
  mainnet: 'eth-mainnet',
  homestead: 'eth-mainnet',
  sepolia: 'eth-sepolia',
  goerli: 'eth-goerli',
  holesky: 'eth-holesky',
  'arbitrum': 'arb-mainnet',
  'arbitrum-sepolia': 'arb-sepolia',
  'optimism': 'opt-mainnet',
  'optimism-sepolia': 'opt-sepolia',
  base: 'base-mainnet',
  'base-sepolia': 'base-sepolia',
  polygon: 'polygon-mainnet',
  'polygon-amoy': 'polygon-amoy'
};
function buildAlchemyUrl(network: string, key: string): string {
  const subdomain = ALCHEMY_SUBDOMAIN[network] || 'eth-mainnet';
  return `https://${subdomain}.g.alchemy.com/v2/${key}`;
}

export class EthereumService {
  private provider: ethers.Provider;
  private signer?: ethers.Wallet;
  private network: string;

  constructor(network?: string, privateKey?: string) {
    this.network = network || process.env.ETHEREUM_NETWORK || 'mainnet';
    
    // Treat obvious placeholder/empty values as unset
    const infuraKey = cleanKey(process.env.INFURA_API_KEY);
    const alchemyKey = cleanKey(process.env.ALCHEMY_API_KEY);
    const rpcUrl = cleanKey(process.env.ETHEREUM_RPC_URL);

    if (rpcUrl) {
      // Highest priority: explicit RPC URL (Alchemy, QuickNode, self-hosted, etc.)
      this.provider = new ethers.JsonRpcProvider(rpcUrl, this.network);
    } else if (infuraKey) {
      this.provider = new ethers.InfuraProvider(this.network, infuraKey);
    } else if (alchemyKey) {
      // ethers v6's AlchemyProvider still targets the decommissioned
      // *.alchemyapi.io endpoints on some builds (returns HTTP 410).
      // Build the modern g.alchemy.com URL directly to stay future-proof.
      const alchemyUrl = buildAlchemyUrl(this.network, alchemyKey);
      this.provider = new ethers.JsonRpcProvider(alchemyUrl, this.network);
    } else {
      // Fallback to public provider (rate-limited — not recommended for prod)
      this.provider = ethers.getDefaultProvider(this.network);
    }

    // Optional signer setup
    const key = privateKey || process.env.DEPLOYER_PRIVATE_KEY;
    if (key) {
      this.signer = new ethers.Wallet(key, this.provider);
    }
  }

  // Get the provider instance
  getProvider(): ethers.Provider {
    return this.provider;
  }

  // Get the signer instance (if available)
  getSigner(): ethers.Wallet | undefined {
    return this.signer;
  }

  // Get current network
  getNetwork(): string {
    return this.network;
  }

  // Get ETH balance for an address
  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  // Get token balance for ERC-20
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    const abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];
    
    const tokenContract = new ethers.Contract(tokenAddress, abi, this.provider);
    const balance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    
    return `${ethers.formatUnits(balance, decimals)} ${symbol}`;
  }

  // Estimate gas for a transaction
  async estimateGas(transaction: ethers.TransactionRequest): Promise<bigint> {
    return await this.provider.estimateGas(transaction);
  }

  // Get current gas price with optional multiplier
  async getGasPrice(): Promise<bigint> {
    const gasPrice = await this.provider.getFeeData();
    const multiplier = process.env.GAS_PRICE_MULTIPLIER 
      ? parseFloat(process.env.GAS_PRICE_MULTIPLIER) 
      : 1.1;
    
    if (gasPrice.gasPrice) {
      return BigInt(Math.floor(Number(gasPrice.gasPrice) * multiplier));
    }
    return BigInt(0);
  }

  // Helper to format transaction data for user wallet signing
  prepareTransaction(txData: ethers.TransactionRequest): object {
    return {
      to: txData.to,
      from: txData.from,
      data: txData.data,
      value: txData.value ? ethers.toBeHex(txData.value) : '0x0',
      gasLimit: txData.gasLimit ? ethers.toBeHex(txData.gasLimit) : undefined
    };
  }

  // Send transaction using signer
  async sendTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.signer) {
      throw new Error("No signer available. Please provide a private key.");
    }
    const response = await this.signer.sendTransaction(tx);
    await response.wait();
    return response.hash;
  }

  // Parse transaction response
  async parseTransactionResponse(txResponse: ethers.TransactionResponse): Promise<object> {
    const receipt = await txResponse.wait();
    return {
      transactionHash: txResponse.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed ? ethers.formatUnits(receipt.gasUsed, 'wei') : '0',
      status: receipt?.status === 1 ? 'success' : 'failed'
    };
  }
}
