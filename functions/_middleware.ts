/**
 * Cloudflare Pages middleware to handle base path routing
 * This middleware handles the /ai-editor/ base path for the application
 * and ensures all static assets are served with proper base path and HTTPS protocol
 */

// Load polyfills for local development
// Polyfill for BroadcastChannel in Node.js/Wrangler local environment
if (typeof globalThis.BroadcastChannel === 'undefined') {
  class BroadcastChannelPolyfill extends EventTarget {
    name: string;
    _closed: boolean;

    constructor(name: string) {
      super();
      this.name = name;
      this._closed = false;
      
      // Store static channels for cross-instance communication
      if (!(globalThis as any)._broadcastChannels) {
        (globalThis as any)._broadcastChannels = new Map();
      }
      
      if (!(globalThis as any)._broadcastChannels.has(name)) {
        (globalThis as any)._broadcastChannels.set(name, new Set());
      }
      
      (globalThis as any)._broadcastChannels.get(name).add(this);
    }
    
    postMessage(data: any) {
      if (this._closed) return;
      
      const event = new MessageEvent('message', {
        data: data,
        origin: 'http://localhost'
      });
      
      // Send to all channels with the same name
      const channels = (globalThis as any)._broadcastChannels.get(this.name);
      if (channels) {
        channels.forEach((channel: any) => {
          if (channel !== this && !channel._closed) {
            // Use setTimeout to make it async like the real API
            setTimeout(() => {
              channel.dispatchEvent(event);
            }, 0);
          }
        });
      }
    }
    
    close() {
      this._closed = true;
      const channels = (globalThis as any)._broadcastChannels.get(this.name);
      if (channels) {
        channels.delete(this);
        if (channels.size === 0) {
          (globalThis as any)._broadcastChannels.delete(this.name);
        }
      }
    }
  }
  
  (globalThis as any).BroadcastChannel = BroadcastChannelPolyfill;
}

// Polyfill for IndexedDB in Cloudflare Workers environment
if (typeof globalThis.indexedDB === 'undefined') {
  // Simple in-memory IndexedDB polyfill for SSR compatibility
  class IDBDatabasePolyfill {
    name: string;
    version: number;
    objectStoreNames: string[] = [];
    
    constructor(name: string, version: number) {
      this.name = name;
      this.version = version;
    }
    
    createObjectStore(name: string, options?: any) {
      this.objectStoreNames.push(name);
      return new IDBObjectStorePolyfill(name, options);
    }
    
    transaction(storeNames: string | string[], mode?: string) {
      return new IDBTransactionPolyfill(storeNames, mode);
    }
    
    close() {}
  }
  
  class IDBObjectStorePolyfill {
    name: string;
    keyPath: any;
    autoIncrement: boolean;
    
    constructor(name: string, options: any = {}) {
      this.name = name;
      this.keyPath = options.keyPath;
      this.autoIncrement = options.autoIncrement || false;
    }
    
    add(value: any, key?: any) {
      return new IDBRequestPolyfill('success', value);
    }
    
    put(value: any, key?: any) {
      return new IDBRequestPolyfill('success', value);
    }
    
    get(key: any) {
      return new IDBRequestPolyfill('success', null);
    }
    
    delete(key: any) {
      return new IDBRequestPolyfill('success', undefined);
    }
    
    clear() {
      return new IDBRequestPolyfill('success', undefined);
    }
    
    createIndex(name: string, keyPath: any, options?: any) {
      return new IDBIndexPolyfill(name, keyPath, options);
    }
  }
  
  class IDBTransactionPolyfill extends EventTarget {
    mode: string;
    objectStoreNames: string[];
    
    constructor(storeNames: string | string[], mode: string = 'readonly') {
      super();
      this.mode = mode;
      this.objectStoreNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    }
    
    objectStore(name: string) {
      return new IDBObjectStorePolyfill(name);
    }
    
    abort() {}
  }
  
  class IDBRequestPolyfill extends EventTarget {
    result: any;
    error: any = null;
    readyState: string;
    
    constructor(state: string, result: any) {
      super();
      this.readyState = state;
      this.result = result;
      
      // Simulate async behavior
      setTimeout(() => {
        // Create a custom event class that extends Event
        class CustomEvent extends Event {
          constructor(type: string, target: any) {
            super(type);
            Object.defineProperty(this, 'target', {
              value: target,
              writable: false,
              enumerable: true,
              configurable: true
            });
            Object.defineProperty(this, 'currentTarget', {
              value: target,
              writable: false,
              enumerable: true,
              configurable: true
            });
          }
        }

        const customEvent = new CustomEvent('success', this);
        this.dispatchEvent(customEvent);
      }, 0);
    }
  }
  
  class IDBIndexPolyfill {
    name: string;
    keyPath: any;
    unique: boolean;
    
    constructor(name: string, keyPath: any, options: any = {}) {
      this.name = name;
      this.keyPath = keyPath;
      this.unique = options.unique || false;
    }
    
    get(key: any) {
      return new IDBRequestPolyfill('success', null);
    }
  }
  
  const indexedDBPolyfill = {
    open(name: string, version?: number) {
      const request = new IDBRequestPolyfill('success', new IDBDatabasePolyfill(name, version || 1));
      
      // Simulate database opening
      setTimeout(() => {
        // Create a custom event class that extends Event
        class CustomEvent extends Event {
          constructor(type: string, target: any) {
            super(type);
            Object.defineProperty(this, 'target', {
              value: target,
              writable: false,
              enumerable: true,
              configurable: true
            });
            Object.defineProperty(this, 'currentTarget', {
              value: target,
              writable: false,
              enumerable: true,
              configurable: true
            });
          }
        }

        const customEvent = new CustomEvent('success', request);
        request.dispatchEvent(customEvent);
      }, 0);
      
      return request;
    },
    
    deleteDatabase(name: string) {
      return new IDBRequestPolyfill('success', undefined);
    }
  };
  
  (globalThis as any).indexedDB = indexedDBPolyfill;
  (globalThis as any).IDBDatabase = IDBDatabasePolyfill;
  (globalThis as any).IDBObjectStore = IDBObjectStorePolyfill;
  (globalThis as any).IDBTransaction = IDBTransactionPolyfill;
  (globalThis as any).IDBRequest = IDBRequestPolyfill;
  (globalThis as any).IDBIndex = IDBIndexPolyfill;
}

interface Env {
  BASE_PATH?: string;
  FERN_FS_URL?: string;
}

interface EventContext {
  request: Request;
  next: (request?: Request) => Promise<Response>;
  env: Env;
}

export const onRequest = async ({ request, next, env }: EventContext): Promise<Response> => {
  const url = new URL(request.url);
  console.log(`[MIDDLEWARE] Processing request: ${request.method} ${url.pathname}`);
  
  /*
   * Get BASE_PATH from environment - no hardcoded fallback
   * If BASE_PATH is not set, the app should work at root
   */
  const BASE_PATH = env.BASE_PATH || '';

  /* For development, also handle the case where BASE_PATH might be set via environment */
  const actualBasePath = BASE_PATH && BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
  
  console.log(`[MIDDLEWARE] BASE_PATH: "${BASE_PATH}", actualBasePath: "${actualBasePath}", pathname: "${url.pathname}"`);

  // Helper function to add cross-origin isolation headers to any response
  const addCrossOriginHeaders = (response: Response) => {
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    // Add cache headers for static assets
    if (url.pathname.includes('/assets/') || url.pathname.includes('/build/')) {
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return newResponse;
  };

  // Helper function to preserve protocol and create proper redirects
  const createRedirect = (targetUrl: string, status: number = 301) => {
    // Always preserve HTTPS protocol when available
    const protocol =
      url.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https' ? 'https:' : url.protocol;
    const newUrl = new URL(targetUrl, `${protocol}//${url.host}`);
    const redirectResponse = Response.redirect(newUrl.toString(), status);

    return addCrossOriginHeaders(redirectResponse);
  };

  /* Handle root redirect - only redirect if we have a base path */
  if (url.pathname === '/' && actualBasePath) {
    return createRedirect(actualBasePath + '/');
  }

  /* Check if the request is for the base path (with or without trailing slash) */
  if (actualBasePath && url.pathname === actualBasePath) {
    return createRedirect(actualBasePath + '/');
  }

  /* Handle requests with base path FIRST - this prevents redirect loops */
  if (actualBasePath && url.pathname.startsWith(actualBasePath + '/')) {
    const pathWithoutBase = url.pathname.slice(actualBasePath.length);

    /* Static assets that should be served with base path */
    const staticAssetPaths = [
      '/assets/',
      '/build/',
      '/favicon',
      '/_next/',
      '/public/',
      '/manifest.json',
      '/robots.txt',
      '/sitemap',
      '/workers-site',
      '/inspector-script.js', // WebContainer inspector script
      '/*.css', // CSS files
      '/*.js', // JavaScript files
      '/*.svg', // SVG files
      '/*.png', // PNG files
      '/*.jpg', // JPG files
      '/*.jpeg', // JPEG files
      '/*.ico', // ICO files
      '/*.woff', // WOFF fonts
      '/*.woff2', // WOFF2 fonts
      '/*.ttf', // TTF fonts
      '/*.eot', // EOT fonts
    ];

    /* Check if it's a static asset with base path - serve directly without modification */
    const isStaticAssetPath = staticAssetPaths.some((path) => {
      if (path.startsWith('/*')) {
        // Handle wildcard patterns like /*.css
        const extension = path.substring(2);
        return pathWithoutBase.endsWith(extension);
      }

      return pathWithoutBase.startsWith(path);
    });

    console.log(`Checking asset path: ${url.pathname}, pathWithoutBase: ${pathWithoutBase}, isStaticAssetPath: ${isStaticAssetPath}`);

    if (isStaticAssetPath) {
      /* Static assets with base path - rewrite URL to stripped path for serving */
      console.log(`Serving static asset: ${url.pathname} -> ${pathWithoutBase}`);

      // Create a new URL with stripped path for asset serving
      const assetUrl = new URL(pathWithoutBase, url.origin);
      const assetRequest = new Request(assetUrl, request);

      const response = await next(assetRequest);

      return addCrossOriginHeaders(response);
    }

    /* Handle fern-fs API proxying */
    if (pathWithoutBase.startsWith('/api/fern-fs/')) {
      // Default to localhost:8080 for local dev, ad-fern-fs for production
      const isProduction = env.RUNNING_IN_DOCKER === 'true' || url.hostname !== 'localhost';
      const fernFsUrl = env.FERN_FS_URL || (isProduction ? 'ad-fern-fs' : 'localhost:8080');
      const fernFsPath = pathWithoutBase.replace('/api/fern-fs', '/api');
      const targetUrl = `http://${fernFsUrl}${fernFsPath}${url.search}`;
      
      console.log(`Proxying fern-fs request: ${url.pathname} -> ${targetUrl}`);
      
      try {
        const proxyRequest = new Request(targetUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });
        
        const response = await fetch(proxyRequest);
        const proxyResponse = new Response(response.body, response);
        
        // Copy headers but add CORS headers
        response.headers.forEach((value, key) => {
          proxyResponse.headers.set(key, value);
        });
        
        return addCrossOriginHeaders(proxyResponse);
      } catch (error) {
        console.error('Fern-fs proxy error:', error);
        return new Response('Fern-fs service unavailable', { status: 503 });
      }
    }

    /* Handle WebSocket connections for fern-fs */
    if (pathWithoutBase.startsWith('/api/ws/fern-fs')) {
      // Default to localhost:8080 for local dev, ad-fern-fs for production
      const isProduction = env.RUNNING_IN_DOCKER === 'true' || url.hostname !== 'localhost';
      const fernFsUrl = env.FERN_FS_URL || (isProduction ? 'ad-fern-fs' : 'localhost:8080');
      const fernFsPath = pathWithoutBase.replace('/api/ws/fern-fs', '/ws');
      const targetUrl = `ws://${fernFsUrl}${fernFsPath}${url.search}`;
      
      console.log(`Proxying WebSocket fern-fs request: ${url.pathname} -> ${targetUrl}`);
      
      // For WebSocket upgrades, we need to handle this differently
      // This is a simplified approach - you might need more sophisticated WebSocket proxying
      const upgradeHeader = request.headers.get('upgrade');
      if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
        try {
          const response = await fetch(targetUrl.replace('ws://', 'http://'), {
            method: request.method,
            headers: request.headers,
          });
          return addCrossOriginHeaders(response);
        } catch (error) {
          console.error('Fern-fs WebSocket proxy error:', error);
          return new Response('Fern-fs WebSocket service unavailable', { status: 503 });
        }
      }
    }

    /* API routes with base path - pass through with full path since Remix now uses basename */
    if (pathWithoutBase.startsWith('/api/')) {
      console.log('Routing API request with full path:', url.pathname);

      const response = await next(request);

      return addCrossOriginHeaders(response);
    }

    /* Handle special Remix endpoints with full path since Remix now uses basename */
    if (pathWithoutBase.startsWith('/__')) {
      console.log('Handling Remix endpoint with full path:', url.pathname);

      const response = await next(request);
      return addCrossOriginHeaders(response);
    }

    /* All other routes with base path - pass through with original path for Remix basename */
    console.log(`Routing to Remix with base path: ${url.pathname}`);

    const response = await next(request);

    return addCrossOriginHeaders(response);
  }

  /* Static assets that should be served with base path */
  const staticAssetPaths = [
    '/assets/',
    '/build/',
    '/favicon',
    '/_next/',
    '/public/',
    '/manifest.json',
    '/robots.txt',
    '/sitemap',
    '/workers-site',
    '/inspector-script.js', // WebContainer inspector script
    '/*.css', // CSS files
    '/*.js', // JavaScript files
    '/*.svg', // SVG files
    '/*.png', // PNG files
    '/*.jpg', // JPG files
    '/*.jpeg', // JPEG files
    '/*.ico', // ICO files
    '/*.woff', // WOFF fonts
    '/*.woff2', // WOFF2 fonts
    '/*.ttf', // TTF fonts
    '/*.eot', // EOT fonts
  ];

  /* Handle special Remix endpoints without redirection for route discovery */
  if (url.pathname === '/__manifest' || url.pathname.startsWith('/__')) {
    console.log(`Handling Remix internal endpoint: ${url.pathname}`);

    /* Pass through to Remix without modification for route discovery */
    const response = await next(request);
    return addCrossOriginHeaders(response);
  }

  /* Check if request is for a static asset without base path - redirect to base path only if we have one */
  if (actualBasePath) {
    const shouldRedirectToBasePath = staticAssetPaths.some((path) => {
      if (path.startsWith('/*')) {
        // Handle wildcard patterns like /*.css
        const extension = path.substring(2);
        return url.pathname.endsWith(extension);
      }

      return url.pathname.startsWith(path);
    });

    if (shouldRedirectToBasePath) {
      /* Redirect static asset requests from /assets/... to /base-path/assets/... */
      console.log(`Redirecting static asset from ${url.pathname} to ${actualBasePath + url.pathname}`);
      return createRedirect(actualBasePath + url.pathname);
    }
  }

  /* API routes without base path should only return 404 if we have a base path configured */
  if (actualBasePath && url.pathname.startsWith('/api/')) {
    return new Response('API route accessed without base path', { status: 404 });
  }

  /* If we have a base path and the request doesn't start with it, return 404 */
  /* If no base path is configured, pass through to the app */
  if (actualBasePath) {
    return new Response('Not found', { status: 404 });
  }

  /* No base path configured - pass through to the app */
  const response = await next(request);

  return addCrossOriginHeaders(response);
};
