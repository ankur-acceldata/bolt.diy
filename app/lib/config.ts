/**
 * Unified configuration system for dynamic host and base path management
 * Supports both browser and server-side environments
 */

export interface AppConfig {
  basePath: string;
  baseUrl: string;
  host?: string;
  port?: number;
  protocol: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

/**
 * Get configuration from various sources with proper fallbacks
 */
function getConfigFromSources(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {};

  // Browser environment - use Vite's environment variables
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    config.basePath = import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL;
    config.host = import.meta.env.VITE_HOST;
    config.port = import.meta.env.VITE_PORT ? parseInt(import.meta.env.VITE_PORT) : undefined;
    config.isDevelopment = import.meta.env.DEV;
    config.isProduction = import.meta.env.PROD;
  }

  // Node.js environment - use process.env
  if (typeof process !== 'undefined' && process.env) {
    config.basePath = config.basePath || process.env.BASE_PATH || process.env.VITE_BASE_PATH;
    config.host = config.host || process.env.HOST || process.env.VITE_HOST;
    config.port = config.port || (process.env.PORT ? parseInt(process.env.PORT) : undefined);
    config.isDevelopment = config.isDevelopment ?? process.env.NODE_ENV === 'development';
    config.isProduction = config.isProduction ?? process.env.NODE_ENV === 'production';
  }

  // Runtime detection for browser
  if (typeof window !== 'undefined') {
    const currentUrl = new URL(window.location.href);
    config.host = config.host || currentUrl.hostname;
    config.port = config.port || (currentUrl.port ? parseInt(currentUrl.port) : undefined);
    config.protocol = currentUrl.protocol;

    // Detect base path from current URL if not explicitly set
    if (!config.basePath && currentUrl.pathname !== '/') {
      const segments = currentUrl.pathname.split('/').filter(Boolean);

      // Check if the first segment looks like a base path (common patterns)
      if (segments.length > 0 && (segments[0].includes('-') || segments[0].length > 2)) {
        config.basePath = `/${segments[0]}`;
      }
    }
  }

  return config;
}

/**
 * Normalize and validate configuration
 */
function normalizeConfig(config: Partial<AppConfig>): AppConfig {
  // Set defaults
  const basePath = config.basePath || '/';
  const baseUrl = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const protocol = config.protocol || (config.isDevelopment ? 'http:' : 'https:');
  const port = config.port || (config.isDevelopment ? 5173 : undefined);

  return {
    basePath: basePath === '/' ? '' : basePath,
    baseUrl,
    host: config.host,
    port,
    protocol,
    isDevelopment: config.isDevelopment || false,
    isProduction: config.isProduction || false,
  };
}

// Cache the configuration to avoid recalculation
let cachedConfig: AppConfig | null = null;

/**
 * Get the current application configuration
 * This function works in both browser and server environments
 */
export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const rawConfig = getConfigFromSources();
  cachedConfig = normalizeConfig(rawConfig);

  return cachedConfig;
}

/**
 * Reset the cached configuration (useful for testing or dynamic updates)
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Get the base path for the application
 */
export function getBasePath(): string {
  return getAppConfig().basePath;
}

/**
 * Get the base URL for the application (with trailing slash)
 */
export function getBaseUrl(): string {
  return getAppConfig().baseUrl;
}

/**
 * Get the full base URL with protocol and host
 */
export function getFullBaseUrl(): string {
  const config = getAppConfig();

  if (typeof window !== 'undefined') {
    // Browser environment - use current origin
    const origin = window.location.origin;
    return origin + config.baseUrl;
  }

  // Server environment - construct from config
  if (config.host) {
    const portPart = config.port && config.port !== 80 && config.port !== 443 ? `:${config.port}` : '';
    return `${config.protocol}//${config.host}${portPart}${config.baseUrl}`;
  }

  // Fallback to relative URL
  return config.baseUrl;
}

/**
 * Construct an API URL with proper base path
 */
export function getApiUrl(path: string): string {
  const basePath = getBasePath();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  return `${basePath}/api${cleanPath}`;
}

/**
 * Construct an asset URL with proper base path
 */
export function getAssetUrl(path: string): string {
  const baseUrl = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  return `${baseUrl}${cleanPath}`;
}

/**
 * Get configuration for display/debugging purposes
 */
export function getConfigSummary(): Record<string, any> {
  const config = getAppConfig();
  return {
    basePath: config.basePath || '(root)',
    baseUrl: config.baseUrl,
    host: config.host || '(auto-detected)',
    port: config.port || '(default)',
    protocol: config.protocol,
    environment: config.isDevelopment ? 'development' : 'production',
    fullBaseUrl: getFullBaseUrl(),
  };
}
