import type { MCPConfig } from './services/mcpService';

/**
 * Configuration helper for XDP MCP Server integration
 */

export interface XDPMCPConfig {
  accessKey: string;
  secretKey: string;
  baseUrl?: string;
  mcpServerUrl?: string;
}

/**
 * Default XDP MCP server configuration
 */
export const DEFAULT_XDP_CONFIG = {
  baseUrl: 'https://demo.xdp-dev.acceldata.tech/xdp-cp-service/api',
  webSocketUrl: 'ws://localhost:9099/ws', // Default to container WebSocket
  accessKey: '9N2J4ZX6UPB8SP5',
  secretKey: 'KDBL51QO8OJSBH9EZ7X7TUN3DEV9WI',
};

/**
 * Create MCP configuration for XDP server
 */
export function createXDPMCPConfig({
  accessKey,
  secretKey,
  baseUrl = DEFAULT_XDP_CONFIG.baseUrl,
  mcpServerUrl,
}: XDPMCPConfig): MCPConfig {
  const callId = Math.random().toString(36).substring(7);
  const isBrowser = typeof window !== 'undefined';
  const callerInfo = new Error().stack?.split('\n')[2]?.trim() || 'unknown';

  console.log(`[${callId}] createXDPMCPConfig called from ${isBrowser ? 'BROWSER' : 'SERVER'}`, {
    accessKey,
    secretKey,
    baseUrl,
    mcpServerUrl,
    caller: callerInfo,
  });

  /*
   * Use HTTP/WS connection only - no stdio mode
   * Get WebSocket URL from mcpServerUrl parameter, environment, or use default
   */
  const mcpWebSocketUrl = process.env.MCP_SERVER_URL || 'ws://localhost:9099/ws';

  console.log(`[${callId}] Environment debug:`, {
    MCP_SERVER_URL: process.env.MCP_SERVER_URL,
    DEFAULT_webSocketUrl: process.env.MCP_SERVER_URL || DEFAULT_XDP_CONFIG.webSocketUrl,
    mcpWebSocketUrl,
  });

  // Convert WebSocket URL to HTTP for streamable-http transport
  console.log(`[${callId}] URL conversion steps:`);
  console.log(`[${callId}]   Original mcpWebSocketUrl:`, mcpWebSocketUrl);

  const step1 = mcpWebSocketUrl.replace('ws://', 'http://');
  console.log(`[${callId}]   After ws->http replace:`, step1);

  const step2 = step1.replace('wss://', 'https://');
  console.log(`[${callId}]   After wss->https replace:`, step2);

  const httpUrl = step2.replace('/ws', '/api/mcp');
  console.log(`[${callId}]   Final httpUrl:`, httpUrl);

  console.log(`[${callId}] Using HTTP MCP connection:`, httpUrl);

  const config = {
    mcpServers: {
      'xdp-server': {
        type: 'streamable-http' as const,
        url: httpUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-XDP-Access-Key': accessKey,
          'X-XDP-Secret-Key': secretKey,
          'X-XDP-Base-URL': baseUrl,
        },
      },
    },
  };

  console.log(`[${callId}] RETURNING CONFIG:`, JSON.stringify(config, null, 2));

  return config;
}

/**
 * Merge XDP MCP config with existing MCP configuration
 */
export function mergeXDPConfig(existingConfig: MCPConfig, xdpConfig: XDPMCPConfig): MCPConfig {
  const xdpMCPConfig = createXDPMCPConfig(xdpConfig);

  return {
    mcpServers: {
      ...existingConfig.mcpServers,
      ...xdpMCPConfig.mcpServers,
    },
  };
}

/**
 * Example configurations for different environments
 */
export const XDP_CONFIG_EXAMPLES = {
  development: {
    baseUrl: 'https://dev-api.xdp.acceldata.dev',
    description: 'Development environment configuration',
  },
  staging: {
    baseUrl: 'https://staging-api.xdp.acceldata.dev',
    description: 'Staging environment configuration',
  },
  production: {
    baseUrl: 'https://api.xdp.acceldata.dev',
    description: 'Production environment configuration',
  },
};

/**
 * Validate XDP MCP configuration
 */
export function validateXDPConfig(config: Partial<XDPMCPConfig>): string[] {
  const errors: string[] = [];

  if (!config.accessKey?.trim()) {
    errors.push('XDP Access Key is required');
  }

  if (!config.secretKey?.trim()) {
    errors.push('XDP Secret Key is required');
  }

  if (config.baseUrl && !isValidUrl(config.baseUrl)) {
    errors.push('Invalid XDP Base URL format');
  }

  return errors;
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate example MCP config with XDP server included
 */
export function generateExampleConfig(xdpConfig?: Partial<XDPMCPConfig>): MCPConfig {
  const baseConfig: MCPConfig = {
    mcpServers: {
      everything: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
      },
      deepwiki: {
        type: 'streamable-http',
        url: 'https://mcp.deepwiki.com/mcp',
      },
    },
  };

  if (xdpConfig?.accessKey && xdpConfig?.secretKey) {
    return mergeXDPConfig(baseConfig, {
      accessKey: xdpConfig.accessKey,
      secretKey: xdpConfig.secretKey,
      baseUrl: xdpConfig.baseUrl,
    });
  }

  // Return config with placeholder values
  const placeholderConfig = createXDPMCPConfig({
    accessKey: 'your-xdp-access-key',
    secretKey: 'your-xdp-secret-key',
  });

  return {
    mcpServers: {
      ...placeholderConfig.mcpServers,
      ...baseConfig.mcpServers,
    },
  };
}
