/**
 * Utility function to construct API URLs with the correct base path
 * This ensures all API calls respect the base path configuration
 */

/**
 * Get the base path from the environment or default to '/bolt/'
 */
export function getBasePath(): string {
  // In Remix, we can use import.meta.env.BASE_URL which is set by Vite
  if (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
    return import.meta.env.BASE_URL;
  }

  // Fallback to /bolt/ if not available
  return '/bolt/';
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
