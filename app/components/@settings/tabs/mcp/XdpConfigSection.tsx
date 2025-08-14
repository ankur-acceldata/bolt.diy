import { useState } from 'react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { validateXDPConfig, XDP_CONFIG_EXAMPLES, type XDPMCPConfig, DEFAULT_XDP_CONFIG } from '~/lib/xdp-mcp-config';
import type { MCPConfig } from '~/lib/services/mcpService';

interface XdpConfigSectionProps {
  onConfigGenerated: (config: MCPConfig) => void;
  onConfigMerge: (_config: MCPConfig) => void;
}

export default function XdpConfigSection({ onConfigGenerated }: XdpConfigSectionProps) {
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_XDP_CONFIG.baseUrl);
  const [serverPath, setServerPath] = useState(DEFAULT_XDP_CONFIG.serverPath);
  const [environment, setEnvironment] = useState<'development' | 'staging' | 'production'>('development');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleValidate = () => {
    const config: XDPMCPConfig = { accessKey, secretKey, baseUrl, serverPath };
    const validationErrors = validateXDPConfig(config);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      toast.success('XDP configuration is valid');
    } else {
      toast.error(`Configuration errors: ${validationErrors.join(', ')}`);
    }
  };

  const handleGenerateConfig = async () => {
    setIsGenerating(true);

    try {
      const config: XDPMCPConfig = { accessKey, secretKey, baseUrl, serverPath };
      const validationErrors = validateXDPConfig(config);

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        toast.error('Please fix validation errors first');

        return;
      }

      const response = await fetch('/api/mcp-xdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          accessKey,
          secretKey,
          baseUrl,
          serverPath,
        }),
      });

      const result = (await response.json()) as { success: boolean; config?: MCPConfig; error?: string };

      if (result.success && result.config) {
        onConfigGenerated(result.config);
        setErrors([]);
        toast.success('XDP MCP configuration generated successfully');
      } else {
        toast.error(result.error || 'Failed to generate configuration');
      }
    } catch (error) {
      console.error('Failed to generate XDP config:', error);
      toast.error('Failed to generate configuration');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadExample = async () => {
    try {
      const response = await fetch('/api/mcp-xdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'example',
          environment,
        }),
      });

      const result = (await response.json()) as {
        success: boolean;
        config?: MCPConfig;
        error?: string;
        description?: string;
      };

      if (result.success && result.config) {
        onConfigGenerated(result.config);
        toast.success(`Loaded ${environment} example configuration`);
      } else {
        toast.error(result.error || 'Failed to load example');
      }
    } catch (error) {
      console.error('Failed to load example:', error);
      toast.error('Failed to load example configuration');
    }
  };

  const handleEnvironmentChange = (env: 'development' | 'staging' | 'production') => {
    setEnvironment(env);
    setBaseUrl(XDP_CONFIG_EXAMPLES[env].baseUrl);
  };

  return (
    <section aria-labelledby="xdp-config-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary">XDP Server Configuration</h3>
        <div className="text-xs text-bolt-elements-textSecondary">Quick setup for XDP MCP integration</div>
      </div>

      <div className="space-y-4">
        {/* Environment Selection */}
        <div>
          <label className="block text-xs text-bolt-elements-textSecondary mb-2">Environment</label>
          <div className="flex gap-2">
            {Object.entries(XDP_CONFIG_EXAMPLES).map(([env]) => (
              <button
                key={env}
                onClick={() => handleEnvironmentChange(env as any)}
                className={classNames(
                  'px-3 py-1.5 text-xs rounded border transition-colors',
                  environment === env
                    ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent'
                    : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-3',
                )}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="xdp-access-key" className="block text-xs text-bolt-elements-textSecondary mb-1">
              Access Key *
            </label>
            <input
              id="xdp-access-key"
              type="text"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              placeholder="Your XDP access key"
              className="w-full px-3 py-2 text-sm rounded border bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
            />
          </div>
          <div>
            <label htmlFor="xdp-secret-key" className="block text-xs text-bolt-elements-textSecondary mb-1">
              Secret Key *
            </label>
            <input
              id="xdp-secret-key"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Your XDP secret key"
              className="w-full px-3 py-2 text-sm rounded border bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
            />
          </div>
        </div>

        {/* Advanced Options */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          >
            <div className={classNames('transition-transform', showAdvanced ? 'rotate-90' : '')}>
              <div className="i-ph:caret-right w-3 h-3" />
            </div>
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-5 border-l border-bolt-elements-borderColor">
              <div>
                <label htmlFor="xdp-base-url" className="block text-xs text-bolt-elements-textSecondary mb-1">
                  Base URL
                </label>
                <input
                  id="xdp-base-url"
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://dev-api.xdp.acceldata.dev"
                  className="w-full px-3 py-2 text-sm rounded border bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
                />
              </div>
              <div>
                <label htmlFor="xdp-server-path" className="block text-xs text-bolt-elements-textSecondary mb-1">
                  Server Path
                </label>
                <input
                  id="xdp-server-path"
                  type="text"
                  value={serverPath}
                  onChange={(e) => setServerPath(e.target.value)}
                  placeholder="/path/to/xdp-mcp-server/dist/index.js"
                  className="w-full px-3 py-2 text-sm rounded border bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor text-bolt-elements-textPrimary focus:outline-none focus:ring-1 focus:ring-bolt-elements-focus"
                />
              </div>
            </div>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-3 rounded border border-bolt-elements-icon-error bg-red-50 dark:bg-red-950/20">
            <div className="text-xs font-medium text-bolt-elements-icon-error mb-1">Configuration Errors:</div>
            <ul className="text-xs text-bolt-elements-icon-error space-y-1">
              {errors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleValidate}
            disabled={!accessKey || !secretKey}
            className="px-3 py-1.5 text-xs rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 disabled:opacity-50"
          >
            Validate
          </button>

          <button
            onClick={handleGenerateConfig}
            disabled={isGenerating || !accessKey || !secretKey}
            className={classNames(
              'px-3 py-1.5 text-xs rounded flex items-center gap-1.5',
              'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent',
              'hover:bg-bolt-elements-item-backgroundActive disabled:opacity-50',
            )}
          >
            {isGenerating ? (
              <div className="i-svg-spinners:90-ring-with-bg w-3 h-3 animate-spin" />
            ) : (
              <div className="i-ph:gear w-3 h-3" />
            )}
            Generate Config
          </button>

          <button
            onClick={handleLoadExample}
            className="px-3 py-1.5 text-xs rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3"
          >
            Load Example
          </button>
        </div>

        {/* Available Tools Info */}
        <div className="p-3 rounded bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
          <div className="text-xs font-medium text-bolt-elements-textPrimary mb-2">Available XDP Tools:</div>
          <div className="text-xs text-bolt-elements-textSecondary space-y-1">
            <div>
              • <code>xdp_list_datastores</code> - List data stores with pagination
            </div>
            <div>
              • <code>trino_execute_query</code> - Execute custom Trino SQL queries
            </div>
            <div>
              • <code>trino_list_catalogs</code> - List available Trino catalogs
            </div>
            <div>
              • <code>trino_list_tables</code> - List tables in a catalog/schema
            </div>
            <div>
              • <code>trino_describe_table</code> - Get column information for tables
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
