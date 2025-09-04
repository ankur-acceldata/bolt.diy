/**
 * Utility for testing XDP MCP integration
 */

import { createXDPMCPConfig } from '~/lib/xdp-mcp-config';

export interface XDPTestConfig {
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
}

/**
 * Test XDP MCP server connection
 */
export async function testXDPConnection(config: XDPTestConfig): Promise<{
  success: boolean;
  error?: string;
  tools?: string[];
}> {
  if (!config.accessKey || !config.secretKey) {
    return {
      success: false,
      error: 'Access key and secret key are required for testing',
    };
  }

  try {
    // Create MCP configuration
    const mcpConfig = createXDPMCPConfig({
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
    });

    // Test the configuration by attempting to connect
    const response = await fetch('/api/mcp-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: mcpConfig }),
    });

    const result = (await response.json()) as { success: boolean; tools?: Record<string, any>; error?: string };

    if (result.success) {
      const tools = Object.keys(result.tools || {});
      const xdpTools = tools.filter((tool) => tool.startsWith('xdp_') || tool.startsWith('trino_'));

      return {
        success: true,
        tools: xdpTools,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Failed to connect to XDP MCP server',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Get example prompts for testing XDP tools
 */
export function getXDPTestPrompts(): Array<{
  title: string;
  prompt: string;
  description: string;
  tools: string[];
}> {
  return [
    {
      title: 'List Data Stores',
      prompt: 'Show me all the data stores available in XDP platform',
      description: 'Tests the xdp_list_datastores tool to fetch available data stores',
      tools: ['xdp_list_datastores'],
    },
    {
      title: 'List Catalogs',
      prompt: 'List all available Trino catalogs for dataplane "my-dataplane"',
      description: 'Tests the trino_list_catalogs tool to show available catalogs',
      tools: ['trino_list_catalogs'],
    },
    {
      title: 'Describe Table Structure',
      prompt:
        'Show me the structure of the table "users" in catalog "default" and schema "public" for dataplane "my-dataplane"',
      description: 'Tests the trino_describe_table tool to show table columns',
      tools: ['trino_describe_table'],
    },
    {
      title: 'Execute Query',
      prompt: 'Execute the query "SELECT COUNT(*) FROM default.public.users" on dataplane "my-dataplane"',
      description: 'Tests the trino_execute_query tool to run custom SQL queries',
      tools: ['trino_execute_query'],
    },
    {
      title: 'List Tables',
      prompt: 'Show me all tables in the "default" catalog for dataplane "my-dataplane"',
      description: 'Tests the trino_list_tables tool to list available tables',
      tools: ['trino_list_tables'],
    },
  ];
}

/**
 * Validate XDP MCP server requirements
 */
export function validateXDPServerRequirements(): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check if Node.js is available
  if (typeof process === 'undefined') {
    issues.push('Node.js runtime not detected');
    suggestions.push('Ensure Node.js is properly installed');
  }

  // Check for HTTP/WS connection requirements
  suggestions.push('Ensure XDP MCP server is running and accessible via HTTP/WebSocket');
  suggestions.push('Ensure XDP credentials (ACCESS_KEY, SECRET_KEY) are valid');
  suggestions.push('Check network connectivity to XDP API endpoints');

  return {
    valid: issues.length === 0,
    issues,
    suggestions,
  };
}
