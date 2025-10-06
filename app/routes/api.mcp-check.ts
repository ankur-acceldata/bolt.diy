import { type LoaderFunction, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { MCPService } from '~/lib/services/mcpService';

const logger = createScopedLogger('api.mcp-check');

interface AppContext {
  env?: {
    MCP_SERVER_URL?: string;
  };
}

export const loader: LoaderFunction = async ({ context }: LoaderFunctionArgs & { context: AppContext }) => {
  try {
    const mcpService = MCPService.getInstance();

    // Pass environment context for initialization
    const mcpServerUrl = context?.env?.MCP_SERVER_URL || process.env.MCP_SERVER_URL;

    // Ensure the service is initialized with XDP config and context
    await mcpService._ensureInitialized(mcpServerUrl);

    const serverTools = await mcpService.checkServersAvailabilities();
    const mcpConfig = mcpService.getCurrentConfig();

    logger.debug('🔍 MCP-CHECK API - Returning data:', {
      serverTools,
      mcpConfig,
      mcpServerUrl,
    });

    return Response.json({
      serverTools,
      mcpConfig,
    });
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
};
