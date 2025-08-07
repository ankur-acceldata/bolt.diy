/**
 * Utility functions for URL construction with base path support
 * Note: API calls now use a fetch interceptor that automatically adds base path
 * These utilities are mainly for asset URLs and navigation
 */

import {
  getBaseUrl as getConfigBaseUrl,
  getApiUrl as getConfigApiUrl,
  getAssetUrl as getConfigAssetUrl,
  getFullBaseUrl,
  getAppConfig,
} from '~/lib/config';

/**
 * Get the base path from the unified configuration system
 * @deprecated Use getBasePath from ~/lib/config instead
 */
export function getBasePath(): string {
  return getConfigBaseUrl();
}

/**
 * Get the current protocol, preferring HTTPS when available
 */
export function getProtocol(): string {
  const config = getAppConfig();

  if (typeof window !== 'undefined') {
    // Always prefer HTTPS in production-like environments
    if (
      window.location.protocol === 'https:' ||
      (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ) {
      return 'https:';
    }

    return window.location.protocol;
  }

  // Use protocol from config or default to HTTPS for server-side rendering
  return config.protocol || 'https:';
}

/**
 * Get the full base URL including protocol and host
 */
export function getBaseUrl(): string {
  return getFullBaseUrl();
}

/**
 * Construct an API URL with the correct base path
 * @param path - The API path (e.g., '/api/models', 'api/chat')
 * @returns The full API URL with base path
 */
export function apiUrl(path: string): string {
  // Use the unified config system for API URLs
  return getConfigApiUrl(path);
}

/**
 * Generate a proper asset URL with base path and protocol
 * @param assetPath - The asset path (e.g., '/favicon.svg', 'assets/image.png')
 * @returns The full asset URL with base path
 */
export function assetUrl(assetPath: string): string {
  // Use the unified config system for asset URLs
  return getConfigAssetUrl(assetPath);
}

/**
 * Generate a full asset URL including protocol and host (for absolute URLs)
 * @param assetPath - The asset path
 * @returns The full absolute asset URL
 */
export function absoluteAssetUrl(assetPath: string): string {
  if (typeof window !== 'undefined') {
    const protocol = getProtocol();
    return `${protocol}//${window.location.host}${assetUrl(assetPath)}`;
  }

  // Fallback for server-side rendering
  return assetUrl(assetPath);
}

/**
 * Navigate to a path while respecting the base path configuration
 */
export function navigateToPath(path: string, replace: boolean = false): void {
  const config = getAppConfig();
  const cleanBasePath = config.basePath;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = cleanBasePath ? `${cleanBasePath}${normalizedPath}` : normalizedPath;

  if (replace) {
    window.location.replace(fullPath);
  } else {
    window.location.href = fullPath;
  }
}

/**
 * Create a chat URL that respects the base path
 */
export function createChatUrl(chatId: string): string {
  const config = getAppConfig();
  const basePath = config.basePath;

  return basePath ? `${basePath}/chat/${chatId}` : `/chat/${chatId}`;
}

/**
 * Navigate to a chat page while respecting the base path
 */
export function navigateToChat(chatId: string, replace: boolean = false): void {
  const chatUrl = createChatUrl(chatId);

  if (replace) {
    window.location.replace(chatUrl);
  } else {
    window.location.href = chatUrl;
  }
}

/**
 * Navigate to the home page while respecting the base path
 */
export function navigateToHome(replace: boolean = false): void {
  navigateToPath('/', replace);
}
