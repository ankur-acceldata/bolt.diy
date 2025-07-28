/**
 * Utility function to construct API URLs with the correct base path
 * This ensures all API calls respect the base path configuration
 */

/**
 * Get the base path from the environment or detect from current URL
 */
export function getBasePath(): string {
  // First try to get from Vite's BASE_URL environment variable
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
    return import.meta.env.BASE_URL;
  }

  // Second, try to detect from current URL in browser by finding the path before known routes
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;

    // Look for known routes and extract the base path before them
    const knownRoutes = ['/chat/', '/api/', '/git', '/settings'];

    for (const route of knownRoutes) {
      const routeIndex = currentPath.indexOf(route);

      if (routeIndex > 0) {
        // Found a known route, extract base path before it
        const basePath = currentPath.substring(0, routeIndex);
        return basePath.endsWith('/') ? basePath : `${basePath}/`;
      }
    }

    /*
     * If we're at the root or a simple path, try to detect if there's a base path
     * by checking if the path looks like it could have a base (contains non-root segments)
     */
    const pathSegments = currentPath.split('/').filter(Boolean);

    if (pathSegments.length === 1 && pathSegments[0] !== '') {
      // Likely a base path like /ai-editor
      return `/${pathSegments[0]}/`;
    }
  }

  // Fallback: check if BASE_PATH environment variable is available (for Node.js contexts)
  if (typeof process !== 'undefined' && process.env?.BASE_PATH) {
    const basePath = process.env.BASE_PATH;
    return basePath.endsWith('/') ? basePath : `${basePath}/`;
  }

  // Final fallback to root path
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
