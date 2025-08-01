/**
 * Utility functions for URL construction with base path support
 * Note: API calls now use a fetch interceptor that automatically adds base path
 * These utilities are mainly for asset URLs and navigation
 */

/**
 * Get the base path from environment variables only
 * No URL detection or complex logic - just env vars
 */
export function getBasePath(): string {
  // First try Vite's BASE_URL (available in browser)
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
    const baseUrl = import.meta.env.BASE_URL;
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  // Fallback to BASE_PATH environment variable (Node.js contexts)
  if (typeof process !== 'undefined' && process.env?.BASE_PATH) {
    const basePath = process.env.BASE_PATH;
    return basePath.endsWith('/') ? basePath : `${basePath}/`;
  }

  // Final fallback to root
  return '/';
}

/**
 * Get the current protocol, preferring HTTPS when available
 */
export function getProtocol(): string {
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

  // Default to HTTPS for server-side rendering
  return 'https:';
}

/**
 * Get the full base URL including protocol and host
 */
export function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const protocol = getProtocol();
    return `${protocol}//${window.location.host}${getBasePath()}`;
  }

  // Server-side fallback
  return getBasePath();
}

/**
 * Construct an API URL with the correct base path
 * @param path - The API path (e.g., '/api/models', 'api/chat')
 * @returns The full API URL with base path
 */
export function apiUrl(path: string): string {
  const basePath = getBasePath();

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Remove trailing slash from base path and ensure proper joining
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  return `${cleanBasePath}${normalizedPath}`;
}

/**
 * Generate a proper asset URL with base path and protocol
 * @param assetPath - The asset path (e.g., '/favicon.svg', 'assets/image.png')
 * @returns The full asset URL with base path
 */
export function assetUrl(assetPath: string): string {
  const basePath = getBasePath();

  // Ensure basePath ends with slash and assetPath doesn't start with slash for proper joining
  const basePathWithSlash = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalizedAssetPath = assetPath.startsWith('/') ? assetPath.substring(1) : assetPath;

  return `${basePathWithSlash}${normalizedAssetPath}`;
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
  const basePath = getBasePath();
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = `${cleanBasePath}${normalizedPath}`;

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
  const basePath = getBasePath();
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  return `${cleanBasePath}/chat/${chatId}`;
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
