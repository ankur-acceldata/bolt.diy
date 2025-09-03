import { createScopedLogger } from '~/utils/logger';
import { MCPService } from '~/lib/services/mcpService';

const logger = createScopedLogger('api.mcp-check');

export async function loader() {
  try {
    const mcpService = MCPService.getInstance();

    // Ensure the service is initialized with XDP config
    await mcpService._ensureInitialized();

    const serverTools = await mcpService.checkServersAvailabilities();
    const mcpConfig = mcpService.getCurrentConfig();

    console.log('🔍 MCP-CHECK API - Returning data:', {
      serverTools,
      mcpConfig,
    });

    return Response.json({
      serverTools,
      mcpConfig,
    });
  } catch (error) {
    logger.error('Error checking MCP servers:', error);
    return Response.json({ error: 'Failed to check MCP servers' }, { status: 500 });
  }
}
