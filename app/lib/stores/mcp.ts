import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('MCPStore');

const MCP_SETTINGS_KEY = 'mcp_settings';
const isBrowser = typeof window !== 'undefined';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
};

type Store = {
  isInitialized: boolean;
  settings: MCPSettings;
  serverTools: MCPServerTools;
  error: string | null;
  isUpdatingConfig: boolean;
};

type Actions = {
  initialize: () => Promise<void>;
  updateSettings: (settings: MCPSettings) => Promise<void>;
  checkServersAvailabilities: () => Promise<void>;
};

export const useMCPStore = create<Store & Actions>((set, get) => ({
  isInitialized: false,
  settings: {
    maxLLMSteps: 10,
    mcpConfig: { mcpServers: {} },
  }, // Minimal initial state - will be populated during initialize()
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    if (get().isInitialized) {
      logger.debug(' MCP Store: Already initialized, skipping');
      return;
    }

    logger.debug('🚀 MCP Store: Starting initialization...');

    if (isBrowser) {
      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);

      if (savedConfig) {
        try {
          const settings = JSON.parse(savedConfig) as MCPSettings;

          /*
           * Browser has saved config - use it but verify with server
           * Get current server config to ensure we have the latest
           */
          logger.debug('MCP Store: Found saved config, verifying with server');

          try {
            const serverData = await getServerConfig();
            const serverCount = Object.keys(serverData.mcpConfig?.mcpServers || {}).length;
            const toolsCount = Object.keys(serverData.serverTools || {}).length;
            logger.debug(`STORE - Got server config with ${serverCount} server(s) and ${toolsCount} tool(s)`);

            // Use server config as the source of truth
            const updatedSettings = {
              ...settings,
              mcpConfig: serverData.mcpConfig,
            };

            localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(updatedSettings));
            set(() => ({ settings: updatedSettings, serverTools: serverData.serverTools }));
            logger.info(' MCP Store: Successfully set server config and tools');
          } catch (error) {
            logger.warn('Failed to get server config, using saved config:', error);

            // Fallback to saved config
            const serverTools = await updateServerConfig(settings.mcpConfig);
            set(() => ({ settings, serverTools }));
          }
        } catch (error) {
          logger.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        /*
         * No saved config in browser - get current server config
         */
        logger.debug('MCP Store: No saved config, getting server configuration');

        try {
          const serverData = await getServerConfig();
          const serverCount = Object.keys(serverData.mcpConfig?.mcpServers || {}).length;
          const toolsCount = Object.keys(serverData.serverTools || {}).length;
          logger.debug(`✅ STORE - Got initial server config with ${serverCount} server(s) and ${toolsCount} tool(s)`);

          const settings: MCPSettings = {
            maxLLMSteps: 10,
            mcpConfig: serverData.mcpConfig,
          };

          localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(settings));
          set(() => ({ settings, serverTools: serverData.serverTools }));
          logger.info(' MCP Store: Successfully initialized with server data');
        } catch (error) {
          logger.warn('Failed to get server config, using minimal settings:', error);

          // Fallback to minimal settings
          const minimalSettings: MCPSettings = {
            maxLLMSteps: 10,
            mcpConfig: { mcpServers: {} },
          };
          localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(minimalSettings));
          set(() => ({ settings: minimalSettings, serverTools: {} }));
        }
      }
    }

    set(() => ({ isInitialized: true }));
    const finalServerCount = Object.keys(get().settings.mcpConfig?.mcpServers || {}).length;
    const finalToolsCount = Object.keys(get().serverTools || {}).length;
    logger.debug(`🏁 MCP Store: Initialization complete - ${finalServerCount} server(s), ${finalToolsCount} tool(s)`);
  },
  updateSettings: async (newSettings: MCPSettings) => {
    if (get().isUpdatingConfig) {
      return;
    }

    try {
      set(() => ({ isUpdatingConfig: true }));

      const serverTools = await updateServerConfig(newSettings.mcpConfig);

      if (isBrowser) {
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(newSettings));
      }

      set(() => ({ settings: newSettings, serverTools }));
    } catch (error) {
      throw error;
    } finally {
      set(() => ({ isUpdatingConfig: false }));
    }
  },
  checkServersAvailabilities: async () => {
    const response = await fetch('/api/mcp-check', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { serverTools: MCPServerTools; mcpConfig: MCPConfig };

    const toolsCount = Object.keys(data.serverTools || {}).length;
    logger.debug(`✅ STORE - checkServersAvailabilities found ${toolsCount} tool(s)`);

    set(() => ({ serverTools: data.serverTools }));
  },
}));

async function updateServerConfig(config: MCPConfig) {
  const response = await fetch('/api/mcp-update-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as MCPServerTools;

  return data;
}

async function getServerConfig(): Promise<{ mcpConfig: MCPConfig; serverTools: MCPServerTools }> {
  const response = await fetch('/api/mcp-check', {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  return data as { mcpConfig: MCPConfig; serverTools: MCPServerTools };
}
