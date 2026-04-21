import { ethers } from 'ethers';
import { z } from 'zod';
import { EthereumService } from '../blockchain/EthereumService';
import { getERC721Template } from '../contracts/templates';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

// New-style tool registration for MCP SDK v1.12+ (Zod shape + MCP content result)
export function registerNftTools(server: any) {
  // Create NFT Collection (ERC-721) contract code
  server.registerTool('eth_create_nft_collection', {
    description: 'Generate an ERC-721 NFT collection contract (Solidity). Deploy afterwards with eth_compile_contract + eth_deploy_contract_with_signer.',
    annotations: {
      title: 'Create NFT Collection',
      readOnlyHint: true,
      openWorldHint: false
    },
    inputSchema: {
      name: z.string().describe('Name of the NFT collection'),
      symbol: z.string().describe('Symbol for the NFT collection'),
      baseURI: z.string().optional().default('').describe('Base URI for token metadata'),
      ownerAddress: z.string().describe('Ethereum address that will own the NFT contract')
    }
  }, async ({ name, symbol, baseURI, ownerAddress }) => {
    try {
      const contractCode = getERC721Template(name, symbol, baseURI || '');
      return {
        content: [{
          type: 'text',
          text: `NFT collection "${name}" (${symbol}) contract generated. Owner: ${ownerAddress}. Base URI: ${baseURI || '(none)'}\n\n\`\`\`solidity\n${contractCode}\n\`\`\``
        }],
        structuredContent: { contractCode, name, symbol, baseURI, ownerAddress }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to generate NFT collection contract: ${error.message}` }],
        isError: true
      };
    }
  });

  // Mint NFT (prepare unsigned tx; execution uses existing eth_send_transaction or wallet)
  server.registerTool('eth_mint_nft', {
    description: 'Prepare a transaction to mint an NFT. Picks mint() / safeMint() / mintWithURI() based on provided parameters.',
    annotations: {
      title: 'Mint NFT',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      contractAddress: z.string().describe('Address of the NFT contract'),
      toAddress: z.string().describe('Address to mint the NFT to'),
      tokenId: z.string().optional().describe('Token ID to mint (omit if the contract auto-assigns)'),
      tokenURI: z.string().optional().describe('URI for the token metadata'),
      fromAddress: z.string().optional().describe('Address with minting permission (defaults to signer)')
    }
  }, async ({ contractAddress, toAddress, tokenId, tokenURI, fromAddress }) => {
    try {
      const provider = ethereumService.getProvider();
      const signer = ethereumService.getSigner();
      const sender = fromAddress || signer?.address;
      if (!sender) {
        throw new Error('fromAddress required and no default signer available.');
      }
      const abi = [
        'function mint(address to, uint256 tokenId) returns (uint256)',
        'function safeMint(address to, uint256 tokenId, string memory uri) returns (uint256)',
        'function mintWithURI(address to, string memory uri) returns (uint256)'
      ];
      const nftContract = new ethers.Contract(contractAddress, abi, provider);

      let data: string;
      if (tokenId && tokenURI) {
        data = nftContract.interface.encodeFunctionData('safeMint', [toAddress, tokenId, tokenURI]);
      } else if (tokenId) {
        data = nftContract.interface.encodeFunctionData('mint', [toAddress, tokenId]);
      } else if (tokenURI) {
        data = nftContract.interface.encodeFunctionData('mintWithURI', [toAddress, tokenURI]);
      } else {
        throw new Error('Either tokenId or tokenURI must be provided for minting.');
      }

      const gasLimit = await ethereumService.estimateGas({ to: contractAddress, from: sender, data });
      const prepared = ethereumService.prepareTransaction({ to: contractAddress, from: sender, data, gasLimit });
      return {
        content: [{
          type: 'text',
          text: `Prepared mint transaction to ${toAddress} on NFT contract ${contractAddress}. Sign with your wallet to broadcast.`
        }],
        structuredContent: { transaction: prepared, contractAddress, toAddress, tokenId, tokenURI }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to prepare NFT mint: ${error.message}` }],
        isError: true
      };
    }
  });

  // Get NFT Owner
  server.registerTool('eth_get_nft_owner', {
    description: 'Get the current owner of an NFT.',
    annotations: {
      title: 'Get NFT Owner',
      readOnlyHint: true,
      openWorldHint: true
    },
    inputSchema: {
      contractAddress: z.string().describe('Address of the NFT contract'),
      tokenId: z.string().describe('Token ID to check ownership for')
    }
  }, async ({ contractAddress, tokenId }) => {
    try {
      const provider = ethereumService.getProvider();
      const abi = ['function ownerOf(uint256 tokenId) view returns (address)'];
      const nftContract = new ethers.Contract(contractAddress, abi, provider);
      const owner = await nftContract.ownerOf(tokenId);
      return {
        content: [{
          type: 'text',
          text: `Token ${tokenId} of ${contractAddress} is owned by ${owner} (${ethereumService.getNetwork()}).`
        }],
        structuredContent: { owner, contractAddress, tokenId, network: ethereumService.getNetwork() }
      };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Failed to get NFT owner: ${error.message}` }],
        isError: true
      };
    }
  });
}
