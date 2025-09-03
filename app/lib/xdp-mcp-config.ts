import type { MCPConfig } from './services/mcpService';

/**
 * Configuration helper for XDP MCP Server integration
 */

export interface XDPMCPConfig {
  accessKey: string;
  secretKey: string;
  baseUrl?: string;
  serverPath?: string;
}

/**
 * Default XDP MCP server configuration
 */
export const DEFAULT_XDP_CONFIG = {
  baseUrl: 'https://demo.xdp-playground.acceldata.tech/xdp-cp-service/api',
  serverPath: '/Users/ankuragarwal/src/xdp-mcp-server/dist/index.js',
  webSocketUrl: 'ws://localhost:9099/ws', // Default to container WebSocket
  accessKey: 'SGTN9GW70UOPFUM',
  secretKey: 'FUY80AFFBHR0EDHQWGLB67PW9S8JOJ',
};

/**
 * Create MCP configuration for XDP server
 */
export function createXDPMCPConfig({
  accessKey,
  secretKey,
  baseUrl = DEFAULT_XDP_CONFIG.baseUrl,
  serverPath = DEFAULT_XDP_CONFIG.serverPath,
}: XDPMCPConfig): MCPConfig {
  const callId = Math.random().toString(36).substring(7);
  const isBrowser = typeof window !== 'undefined';
  const callerInfo = new Error().stack?.split('\n')[2]?.trim() || 'unknown';

  console.log(`[${callId}] createXDPMCPConfig called from ${isBrowser ? 'BROWSER' : 'SERVER'}`, {
    accessKey,
    secretKey,
    baseUrl,
    serverPath,
    caller: callerInfo,
  });

  /*
   * Check environment variables for connection type (server-side only)
   * In browser, environment variables are not available, so we use defaults
   */
  const mcpWebSocketUrl = isBrowser
    ? DEFAULT_XDP_CONFIG.webSocketUrl
    : process.env.MCP_SERVER_URL || DEFAULT_XDP_CONFIG.webSocketUrl;
  const forceStdio = isBrowser ? false : process.env.MCP_USE_STDIO === 'true';

  console.log(`[${callId}] Environment debug:`, {
    MCP_SERVER_URL: process.env.MCP_SERVER_URL,
    DEFAULT_webSocketUrl: DEFAULT_XDP_CONFIG.webSocketUrl,
    mcpWebSocketUrl,
    forceStdio,
    willUseHTTP: !forceStdio && mcpWebSocketUrl,
  });

  if (!forceStdio && mcpWebSocketUrl) {
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

  // Fallback to STDIO connection
  console.log(`[${callId}] Using STDIO MCP connection:`, serverPath);

  return {
    mcpServers: {
      'xdp-server': {
        type: 'stdio',
        command: 'node',
        args: [serverPath],
        env: {
          XDP_ACCESS_KEY: accessKey,
          XDP_SECRET_KEY: secretKey,
          XDP_BASE_URL: baseUrl,
        },
      },
    },
  };
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

  if (config.serverPath && !config.serverPath.endsWith('.js')) {
    errors.push('Server path must point to a JavaScript file');
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
      serverPath: xdpConfig.serverPath,
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
