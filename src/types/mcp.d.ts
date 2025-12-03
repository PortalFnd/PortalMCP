// Type definitions for the MCP SDK

declare module '@modelcontextprotocol/sdk' {
  export interface MCPTool {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
    handler: (params: any) => Promise<any>;
  }
}

declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export interface MCPTool {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
    handler: (params: any) => Promise<any>;
  }
}
