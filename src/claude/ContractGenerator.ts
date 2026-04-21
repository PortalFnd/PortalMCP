import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

// Model can be overridden via env; default to the latest Sonnet at build time.
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

// Initialize Anthropic client (SDK 0.90+ uses default export)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate Solidity contract code using Claude AI
 * @param description Natural language description of the contract functionality
 * @param contractType Type of contract (e.g., ERC20, ERC721, Custom)
 * @param additionalFeatures List of additional features to include
 * @returns The generated Solidity code
 */
export async function generateContractWithClaude(
  description: string,
  contractType?: string,
  additionalFeatures?: string[]
): Promise<string> {
  // Prepare prompt for Claude
  let contractTypeStr = contractType ? `a ${contractType} token` : 'a custom smart contract';
  let featuresStr = '';
  
  if (additionalFeatures && additionalFeatures.length > 0) {
    featuresStr = '\nPlease include these additional features:\n' + 
      additionalFeatures.map(feature => `- ${feature}`).join('\n');
  }

  const prompt = `Generate ${contractTypeStr} Solidity smart contract based on this description:\n\n${description}\n${featuresStr}\n\nRequirements:\n\n1. Use the latest Solidity version (0.8.x)\n2. Follow best practices for security and gas optimization\n3. Include clear comments for all functions and complex logic\n4. Implement proper access control mechanisms\n5. Validate all inputs\n6. Include events for important state changes\n7. Handle edge cases appropriately\n\nOnly respond with the complete Solidity code, no explanations or other text.`;

  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    // Concatenate all text blocks (new SDK returns content as a typed array).
    const responseText = response.content
      .map(block => (block.type === 'text' ? block.text : ''))
      .join('');

    return extractSolidityCode(responseText);
  } catch (error) {
    console.error('Error generating contract with Claude:', error);
    throw error;
  }
}

// Helper to extract Solidity code from Claude's response
function extractSolidityCode(text: string): string {
  // Remove any markdown code blocks if present
  return text.replace(/```solidity|```/g, '').trim();
}
