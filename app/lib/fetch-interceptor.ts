/**
 * Fetch interceptor that automatically adds base path to API calls
 * This eliminates the need for developers to use a special apiFetch function
 */

let interceptorInstalled = false;
let originalFetch: typeof fetch;

/**
 * Get the base path from environment variables only
 * No URL detection or complex logic - just env vars
 */
function getBasePath(): string {
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

    // Call original fetch with the modified URL
    if (typeof input === 'string') {
      return originalFetch(finalUrl, init);
    } else if (input instanceof URL) {
      return originalFetch(new URL(finalUrl), init);
    } else if (input instanceof Request) {
      // Create a new request with the modified URL
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
        ...init, // Allow init to override request properties
      });
      return originalFetch(newRequest);
    } else {
      return originalFetch(finalUrl, init);
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
