import { MCPTool } from '@modelcontextprotocol/sdk';
import { ethers } from 'ethers';
import { EthereumService } from '../blockchain/EthereumService';
import { getERC721Template } from '../contracts/templates';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

export const nftTools: MCPTool[] = [
  {
    name: 'eth_create_nft_collection',
    description: 'Create a new NFT collection (ERC-721 contract)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the NFT collection' },
        symbol: { type: 'string', description: 'Symbol for the NFT collection' },
        baseURI: { type: 'string', description: 'Base URI for token metadata' },
        ownerAddress: { type: 'string', description: 'Ethereum address that will own the NFT contract' },
      },
      required: ['name', 'symbol', 'ownerAddress']
    },
    async handler({ name, symbol, baseURI, ownerAddress }) {
      // Generate the contract code
      const contractCode = getERC721Template(name, symbol, baseURI || '');
      
      // Return data needed for deployment
      return {
        contractCode,
        name,
        symbol,
        baseURI,
        ownerAddress,
        message: 'NFT collection contract generated. Review the code and use eth_deploy_contract to deploy it.'
      };
    }
  },
  
  {
    name: 'eth_mint_nft',
    description: 'Prepare a transaction to mint an NFT to a specified address',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: { type: 'string', description: 'Address of the NFT contract' },
        toAddress: { type: 'string', description: 'Address to mint the NFT to' },
        tokenId: { type: 'string', description: 'Token ID to mint (if empty, contract will auto-assign)' },
        tokenURI: { type: 'string', description: 'URI for the token metadata' },
        fromAddress: { type: 'string', description: 'Address with minting permission (usually the contract owner)' },
      },
      required: ['contractAddress', 'toAddress', 'fromAddress']
    },
    async handler({ contractAddress, toAddress, tokenId, tokenURI, fromAddress }) {
      try {
        const provider = ethereumService.getProvider();
        const abi = [
          'function mint(address to, uint256 tokenId) returns (uint256)',
          'function safeMint(address to, uint256 tokenId, string memory uri) returns (uint256)',
          'function mintWithURI(address to, string memory uri) returns (uint256)',
        ];
        
        const nftContract = new ethers.Contract(contractAddress, abi, provider);
        let data;
        
        // Determine which minting function to call based on available parameters
        if (tokenId && tokenURI) {
          data = nftContract.interface.encodeFunctionData('safeMint', [toAddress, tokenId, tokenURI]);
        } else if (tokenId) {
          data = nftContract.interface.encodeFunctionData('mint', [toAddress, tokenId]);
        } else if (tokenURI) {
          data = nftContract.interface.encodeFunctionData('mintWithURI', [toAddress, tokenURI]);
        } else {
          return { error: 'Either tokenId or tokenURI must be provided for minting' };
        }
        
        // Create unsigned transaction
        const gasLimit = await ethereumService.estimateGas({
          to: contractAddress,
          from: fromAddress,
          data,
        });
        
        const transaction = {
          to: contractAddress,
          from: fromAddress,
          data,
          gasLimit,
        };
        
        return {
          transaction: ethereumService.prepareTransaction(transaction),
          message: `Transaction prepared to mint NFT to ${toAddress}. The user needs to sign this transaction with their wallet.`
        };
      } catch (error) {
        return { error: `Failed to prepare NFT minting: ${error.message}` };
      }
    }
  },
  
  {
    name: 'eth_get_nft_owner',
    description: 'Get the current owner of an NFT',
    parameters: {
      type: 'object',
      properties: {
        contractAddress: { type: 'string', description: 'Address of the NFT contract' },
        tokenId: { type: 'string', description: 'Token ID to check ownership for' },
      },
      required: ['contractAddress', 'tokenId']
    },
    async handler({ contractAddress, tokenId }) {
      try {
        const provider = ethereumService.getProvider();
        const abi = ['function ownerOf(uint256 tokenId) view returns (address)'];
        
        const nftContract = new ethers.Contract(contractAddress, abi, provider);
        const owner = await nftContract.ownerOf(tokenId);
        
        return {
          owner,
          contractAddress,
          tokenId,
          network: ethereumService.getNetwork()
        };
      } catch (error) {
        return { error: `Failed to get NFT owner: ${error.message}` };
      }
    }
  }
];
