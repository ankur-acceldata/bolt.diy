/**
 * Cloudflare Pages middleware to handle base path routing
 * This middleware handles the /ai-editor/ base path for the application
 * and ensures all static assets are served with proper base path and HTTPS protocol
 */

interface Env {
  BASE_PATH?: string;
}

interface EventContext {
  request: Request;
  next: (request?: Request) => Promise<Response>;
  env: Env;
}

export const onRequest = async ({ request, next, env }: EventContext): Promise<Response> => {
  /*
   * Get BASE_PATH from environment - no hardcoded fallback
   * If BASE_PATH is not set, the app should work at root
   */
  const BASE_PATH = env.BASE_PATH || '';
  const url = new URL(request.url);

  /* For development, also handle the case where BASE_PATH might be set via environment */
  const actualBasePath = BASE_PATH && BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;

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

    /* Check if it's a static asset with base path - serve directly */
    const isStaticAssetPath = staticAssetPaths.some((path) => {
      if (path.startsWith('/*')) {
        // Handle wildcard patterns like /*.css
        const extension = path.substring(2);
        return pathWithoutBase.endsWith(extension);
      }

      return pathWithoutBase.startsWith(path);
    });

    if (isStaticAssetPath) {
      /* Static assets with base path - pass through to be served directly */
      console.log(`Serving static asset: ${url.pathname}`);

      const response = await next(request);

      return addCrossOriginHeaders(response);
    }

    /* API routes with base path - pass through to Remix WITHOUT modification */
    if (pathWithoutBase.startsWith('/api/')) {
      console.log('Passing API route with base path to Remix:', url.pathname);

      const response = await next(request);

      return addCrossOriginHeaders(response);
    }

    /* All other routes with base path - pass through to Remix */
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
