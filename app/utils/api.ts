/**
 * Utility function to construct API URLs with the correct base path
 * This ensures all API calls respect the base path configuration
 */

/**
 * Get the base path from the environment or default to '/ai-editor/'
 */
export function getBasePath(): string {
  // First try to get from Vite's BASE_URL environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
    return import.meta.env.BASE_URL;
  }

  // Second, try to detect from current URL in browser
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;

    if (currentPath.startsWith('/ai-editor/')) {
      return '/ai-editor/';
    }
  }

  // Fallback to /ai-editor/ if not available
  return '/ai-editor/';
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
 * Enhanced fetch wrapper that automatically handles base path for API calls
 * @param path - The API path
 * @param init - Fetch options
 * @returns Promise<Response>
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
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
