/**
 * Fetch interceptor that automatically adds base path and authorization headers to API calls
 * This eliminates the need for developers to use a special apiFetch function
 */

let interceptorInstalled = false;
let originalFetch: typeof fetch;

import { getBasePath as getConfigBasePath } from './config';
import { AuthUtils } from './auth';

/**
 * Get the base path from the unified configuration system
 */
function getBasePath(): string {
  return getConfigBasePath();
}

/**
 * Check if a URL should have the base path applied
 */
function shouldApplyBasePath(url: string): boolean {
  // Only apply to relative API paths
  if (url.startsWith('/api/')) {
    return true;
  }

  // Don't apply to absolute URLs
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return false;
  }

  // Don't apply to other relative paths (assets, etc.)
  return false;
}

/**
 * Apply base path to a URL if needed
 */
function applyBasePath(url: string): string {
  if (!shouldApplyBasePath(url)) {
    return url;
  }

  const basePath = getBasePath();
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;

  return `${cleanBasePath}${url}`;
}

/**
 * Check if a URL should have authorization headers applied
 */
function shouldApplyAuthHeaders(url: string): boolean {
  // Only apply to relative API paths
  if (url.startsWith('/api/')) {
    return true;
  }

  // Don't apply to absolute URLs (external APIs)
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return false;
  }

  return false;
}

/**
 * Apply authorization headers to request init if needed
 */
function applyAuthHeaders(url: string, init?: RequestInit): RequestInit {
  if (!shouldApplyAuthHeaders(url)) {
    return init || {};
  }

  const authHeaders = AuthUtils.getAuthHeaders();
  const headers = new Headers(init?.headers);

  // Only add auth headers if they have values and don't already exist
  Object.entries(authHeaders).forEach(([key, value]) => {
    if (value && !headers.has(key)) {
      headers.set(key, value);
    }
  });

  return {
    ...init,
    headers,
  };
}

/**
 * Install the fetch interceptor
 * This should be called early in the application lifecycle
 */
export function installFetchInterceptor(): void {
  if (interceptorInstalled) {
    return; // Already installed
  }

  if (typeof fetch === 'undefined') {
    // fetch is not available (e.g., in some Node.js environments)
    return;
  }

  // Store the original fetch
  originalFetch = fetch;

  // Replace global fetch with our interceptor
  globalThis.fetch = function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    let url: string;

    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      // Fallback for other types
      url = String(input);
    }

    // Apply base path if needed
    const finalUrl = applyBasePath(url);

    // Apply authorization headers if needed
    const finalInit = applyAuthHeaders(url, init);

    // Call original fetch with the modified URL and headers
    if (typeof input === 'string') {
      return originalFetch(finalUrl, finalInit);
    } else if (input instanceof URL) {
      return originalFetch(new URL(finalUrl), finalInit);
    } else if (input instanceof Request) {
      // Create a new request with the modified URL and headers
      const enhancedInit = applyAuthHeaders(url, init);
      const newRequest = new Request(finalUrl, {
        method: input.method,
        headers: input.headers,
        body: input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        integrity: input.integrity,
        signal: input.signal,
        ...enhancedInit, // Apply auth headers and allow init to override
      });

      return originalFetch(newRequest);
    } else {
      return originalFetch(finalUrl, finalInit);
    }
  };

  interceptorInstalled = true;
}

/**
 * Uninstall the fetch interceptor (mainly for testing)
 */
export function uninstallFetchInterceptor(): void {
  if (!interceptorInstalled || !originalFetch) {
    return;
  }

  globalThis.fetch = originalFetch;
  interceptorInstalled = false;
}

/**
 * Check if the interceptor is installed
 */
export function isInterceptorInstalled(): boolean {
  return interceptorInstalled;
}

/**
 * Get the original fetch function (for direct access if needed)
 */
export function getOriginalFetch(): typeof fetch | undefined {
  return originalFetch;
}

/**
 * Re-export AuthUtils for backward compatibility
 */
export { AuthUtils } from './auth';
