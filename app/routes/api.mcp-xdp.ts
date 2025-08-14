import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import {
  createXDPMCPConfig,
  validateXDPConfig,
  generateExampleConfig,
  XDP_CONFIG_EXAMPLES,
  type XDPMCPConfig,
} from '~/lib/xdp-mcp-config';

export async function loader() {
  return json({
    success: true,
    examples: XDP_CONFIG_EXAMPLES,
    defaultConfig: generateExampleConfig(),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const body = (await request.json()) as Record<string, any>;
    const { action: actionType, ...config } = body;

    switch (actionType) {
      case 'validate': {
        const errors = validateXDPConfig(config as Partial<XDPMCPConfig>);
        return json({
          success: errors.length === 0,
          errors,
          isValid: errors.length === 0,
        });
      }

      case 'generate': {
        const { accessKey, secretKey, baseUrl, serverPath } = config as XDPMCPConfig;

        if (!accessKey || !secretKey) {
          return json({
            success: false,
            error: 'Access key and secret key are required',
          });
        }

        const mcpConfig = createXDPMCPConfig({
          accessKey,
          secretKey,
          baseUrl,
          serverPath,
        });

        return json({
          success: true,
          config: mcpConfig,
        });
      }

      case 'example': {
        const { environment = 'development' } = config;
        const exampleConfig = generateExampleConfig();

        if (environment in XDP_CONFIG_EXAMPLES) {
          // Update the base URL in the example config
          const envConfig = XDP_CONFIG_EXAMPLES[environment as keyof typeof XDP_CONFIG_EXAMPLES];
          const xdpServer = exampleConfig.mcpServers['xdp-server'];

          if (xdpServer && xdpServer.type === 'stdio' && xdpServer.env) {
            xdpServer.env.XDP_BASE_URL = envConfig.baseUrl;
          }
        }

        return json({
          success: true,
          config: exampleConfig,
          description:
            XDP_CONFIG_EXAMPLES[environment as keyof typeof XDP_CONFIG_EXAMPLES]?.description ||
            'Example configuration',
        });
      }

      default:
        return json({
          success: false,
          error: `Unknown action: ${actionType}`,
        });
    }
  } catch (error) {
    console.error('XDP MCP API error:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
}
