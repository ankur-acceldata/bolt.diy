/**
 * Cloudflare Pages middleware to handle base path routing
 * This middleware handles the /ai-editor/ base path for the application
 */

export const onRequest: PagesFunction = async ({ request, next, env }) => {
  const BASE_PATH = (env as any).BASE_PATH || '/ai-editor';
  const url = new URL(request.url);

  /* For development, also handle the case where BASE_PATH might be set via environment */
  const actualBasePath = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;

  /* Handle root redirect - redirect / to /ai-editor/ */
  if (url.pathname === '/') {
    return Response.redirect(url.origin + actualBasePath + '/', 301);
  }

  /* Check if the request is for the base path (with or without trailing slash) */
  if (url.pathname === actualBasePath) {
    return Response.redirect(url.origin + actualBasePath + '/', 301);
  }

  /* Static assets that should be served without base path */
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
  ];

  const shouldAllowStaticPath = staticAssetPaths.some((path) => url.pathname.startsWith(path));

  /* API routes without base path should return 404 */
  if (url.pathname.startsWith('/api/')) {
    return new Response('API route accessed without base path', { status: 404 });
  }

  /* If it's a static asset without base path, allow it */
  if (shouldAllowStaticPath) {
    return next(request);
  }

  /* Handle requests with base path */
  if (url.pathname.startsWith(actualBasePath + '/')) {
    const pathWithoutBase = url.pathname.slice(actualBasePath.length);

    /* Check if it's a static asset with base path - redirect to remove base path */
    const isStaticAssetPath = staticAssetPaths.some((path) => pathWithoutBase.startsWith(path));

    if (isStaticAssetPath) {
      /* Redirect static asset requests from /ai-editor/assets/... to /assets/... */
      const newUrl = new URL(request.url);
      newUrl.pathname = pathWithoutBase;

      return Response.redirect(newUrl.toString(), 302);
    }

    /* API routes with base path - pass through to Remix WITHOUT modification */
    if (pathWithoutBase.startsWith('/api/')) {
      console.log('Passing API route with base path to Remix:', url.pathname);

      const response = await next(request);

      /* Add CORS headers for WebContainer support */
      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

      return newResponse;
    }

    /* All other routes with base path - pass through to Remix */
    const response = await next(request);

    /* Add CORS headers for WebContainer support */
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return newResponse;
  }

  /* If the request doesn't start with the base path and isn't a static asset, return 404 */
  return new Response('Not found', { status: 404 });
};
