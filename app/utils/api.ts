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
