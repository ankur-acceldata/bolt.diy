import { create } from 'zustand';
import type { MCPConfig, MCPServerTools } from '~/lib/services/mcpService';
import { createXDPMCPConfig, DEFAULT_XDP_CONFIG } from '~/lib/xdp-mcp-config';

const MCP_SETTINGS_KEY = 'mcp_settings';
const isBrowser = typeof window !== 'undefined';

type MCPSettings = {
  mcpConfig: MCPConfig;
  maxLLMSteps: number;
};

// Create default MCP configuration with XDP server (lazy initialization)
const getDefaultXDPConfig = () =>
  createXDPMCPConfig({
    accessKey: DEFAULT_XDP_CONFIG.accessKey,
    secretKey: DEFAULT_XDP_CONFIG.secretKey,
    baseUrl: DEFAULT_XDP_CONFIG.baseUrl,
    serverPath: DEFAULT_XDP_CONFIG.serverPath,
  });

const getDefaultSettings = (): MCPSettings => ({
  maxLLMSteps: 5,
  mcpConfig: getDefaultXDPConfig(),
});

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
  settings: getDefaultSettings(),
  serverTools: {},
  error: null,
  isUpdatingConfig: false,
  initialize: async () => {
    if (get().isInitialized) {
      return;
    }

    if (isBrowser) {
      const savedConfig = localStorage.getItem(MCP_SETTINGS_KEY);

      if (savedConfig) {
        try {
          const settings = JSON.parse(savedConfig) as MCPSettings;

          // Always override with fresh XDP config to pick up environment variables
          const freshDefaultSettings = getDefaultSettings();
          const updatedSettings = {
            ...settings,
            mcpConfig: freshDefaultSettings.mcpConfig,
          };

          localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(updatedSettings));

          const serverTools = await updateServerConfig(updatedSettings.mcpConfig);
          set(() => ({ settings: updatedSettings, serverTools }));
        } catch (error) {
          console.error('Error parsing saved mcp config:', error);
          set(() => ({
            error: `Error parsing saved mcp config: ${error instanceof Error ? error.message : String(error)}`,
          }));
        }
      } else {
        // Initialize with default XDP configuration
        const defaultSettings = getDefaultSettings();
        localStorage.setItem(MCP_SETTINGS_KEY, JSON.stringify(defaultSettings));

        const serverTools = await updateServerConfig(defaultSettings.mcpConfig);
        set(() => ({ settings: defaultSettings, serverTools }));
      }
    }

    set(() => ({ isInitialized: true }));
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

    const serverTools = (await response.json()) as MCPServerTools;

    set(() => ({ serverTools }));
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
