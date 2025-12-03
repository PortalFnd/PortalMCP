import solc from 'solc';

/**
 * Compile Solidity code using solc
 * @param sourceCode Solidity source code
 * @param contractName Name of the main contract to compile
 * @returns Object containing ABI and bytecode
 */
export async function compileSolidity(sourceCode: string, contractName: string) {
  // Input structure for solc
  const input = {
    language: 'Solidity',
    sources: {
      'contract.sol': {
        content: sourceCode
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  try {
    // Compile the source code
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    // Check for errors
    if (output.errors) {
      const errors = output.errors.filter((error: any) => error.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Compilation errors: ${errors.map((e: any) => e.message).join('\n')}`);
      }
    }
    
    // Extract ABI and bytecode
    const contract = output.contracts['contract.sol'][contractName];
    if (!contract) {
      throw new Error(`Contract ${contractName} not found in compiled output`);
    }
    
    return {
      abi: contract.abi,
      bytecode: '0x' + contract.evm.bytecode.object
    };
  } catch (error) {
    if (error.message && error.message.includes('Contract not found')) {
      throw new Error(`Contract ${contractName} not found. Make sure the contract name matches exactly.`);
    } else {
      throw error;
    }
  }
}
