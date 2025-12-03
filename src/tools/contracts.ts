import { ethers } from 'ethers';
import { z } from 'zod';
import { EthereumService } from '../blockchain/EthereumService';
import { compileSolidity } from '../blockchain/CompilerService';
import { generateContractWithClaude } from '../claude/ContractGenerator';

const ethereumService = new EthereumService(process.env.ETHEREUM_NETWORK);

// New style tool registration for MCP SDK v1.12.0
export function registerContractTools(server: any) {
  // Generate Contract Tool
  server.registerTool('eth_generate_contract', {
    description: 'Generate Solidity contract code using Claude AI',
    inputSchema: {
      description: z.string().describe('Detailed description of the contract functionality'),
      contractType: z.string().optional().describe('Type of contract (e.g., ERC20, ERC721, Custom)'),
      additionalFeatures: z.array(z.string()).optional().describe('List of additional features to include')
    }
  }, async ({ description, contractType, additionalFeatures }) => {
    try {
      const contractCode = await generateContractWithClaude(description, contractType, additionalFeatures);
      
      return {
        content: [{
          type: 'text',
          text: `Contract code generated successfully. Review the code before compilation and deployment.\n\n\`\`\`solidity\n${contractCode}\n\`\`\``
        }],
        structuredContent: {
          contractCode,
          contractType,
          features: additionalFeatures
        }
      };
    } catch (error) {
      console.error('Error generating contract:', error);
      throw error;
    }
  });

  // Compile Contract Tool
  server.registerTool('eth_compile_contract', {
    description: 'Compile Solidity contract code to bytecode and ABI',
    inputSchema: {
      contractCode: z.string().describe('Solidity code to compile'),
      contractName: z.string().describe('Name of the main contract in the code')
    }
  }, async ({ contractCode, contractName }) => {
    try {
      const compiled = await compileSolidity(contractCode, contractName);
      
      return {
        content: [{
          type: 'text',
          text: `Contract compiled successfully!\n\nBytecode: ${compiled.bytecode.slice(0, 100)}...\nABI: ${JSON.stringify(compiled.abi, null, 2)}`
        }],
        structuredContent: {
          bytecode: compiled.bytecode,
          abi: compiled.abi,
          contractName
        }
      };
    } catch (error) {
      console.error('Error compiling contract:', error);
      throw error;
    }
  });

  // Deploy Contract (Prepare Transaction) Tool
  server.registerTool('eth_deploy_contract', {
    description: 'Prepare a transaction to deploy a compiled contract',
    inputSchema: {
      bytecode: z.string().describe('Contract bytecode from compilation'),
      abi: z.array(z.any()).describe('Contract ABI from compilation'),
      constructorArgs: z.array(z.any()).optional().describe('Constructor arguments for the contract'),
      fromAddress: z.string().describe('Address that will deploy the contract'),
      value: z.string().optional().describe('Amount of ETH to send with deployment (in ETH, not wei)')
    }
  }, async ({ bytecode, abi, constructorArgs, fromAddress, value }) => {
    try {
      const factory = new ethers.ContractFactory(abi, bytecode);
      
      // Encode deployment data
      const args = constructorArgs || [];
      const deploymentData = factory.interface.encodeDeploy(args);
      
      // Calculate full deployment bytecode
      const fullBytecode = bytecode + deploymentData.slice(2); // Remove 0x from deploymentData
      
      // Convert ETH value to wei if provided
      const valueWei = value ? ethers.parseEther(value) : undefined;
      
      // Prepare transaction object
      const transactionRequest = {
        from: fromAddress,
        data: fullBytecode,
        value: valueWei,
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
          text: `Transaction prepared to deploy contract from ${fromAddress}. The user needs to sign this transaction with their wallet.`
        }],
        structuredContent: {
          transaction: preparedTransaction
        }
      };
    } catch (error) {
      console.error('Error preparing contract deployment:', error);
      throw error;
    }
  });

  // Deploy Contract with Signer (Actually Deploy) Tool
  server.registerTool('eth_deploy_contract_with_signer', {
    description: 'Deploy a contract using the configured private key (signer)',
    inputSchema: {
      bytecode: z.string().describe('Contract bytecode from compilation'),
      abi: z.array(z.any()).describe('Contract ABI from compilation'),
      constructorArgs: z.array(z.any()).optional().describe('Constructor arguments for the contract'),
      value: z.string().optional().describe('Amount of ETH to send with deployment (in ETH, not wei)')
    }
  }, async ({ bytecode, abi, constructorArgs, value }) => {
    try {
      const signer = ethereumService.getSigner();
      if (!signer) {
        throw new Error('No signer available. Please set DEPLOYER_PRIVATE_KEY in your environment variables.');
      }

      // Convert ETH value to wei if provided
      const valueWei = value ? ethers.parseEther(value) : 0;

      // Create contract factory with signer
      const contractFactory = new ethers.ContractFactory(abi, bytecode, signer);
      
      // Deploy the contract
      const args = constructorArgs || [];
      const contract = await contractFactory.deploy(...args, { value: valueWei });
      
      // Wait for deployment
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      
      return {
        content: [{
          type: 'text',
          text: `Contract deployed successfully!\nContract Address: ${contractAddress}\nTransaction Hash: ${contract.deploymentTransaction()?.hash}\nDeployer: ${signer.address}`
        }],
        structuredContent: {
          contractAddress,
          transactionHash: contract.deploymentTransaction()?.hash,
          deployerAddress: signer.address,
          network: ethereumService.getNetwork()
        }
      };
    } catch (error) {
      console.error('Error deploying contract:', error);
      throw error;
    }
  });
}
