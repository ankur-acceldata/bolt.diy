import { cloudflareDevProxyVitePlugin as remixCloudflareDevProxy, vitePlugin as remixVitePlugin } from '@remix-run/dev';
import UnoCSS from 'unocss/vite';
import { defineConfig, type ViteDevServer, loadEnv } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { optimizeCssModules } from 'vite-plugin-optimize-css-modules';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

dotenv.config();

// Get detailed git info with fallbacks
const getGitInfo = () => {
  try {
    return {
      commitHash: execSync('git rev-parse --short HEAD').toString().trim(),
      branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
      commitTime: execSync('git log -1 --format=%cd').toString().trim(),
      author: execSync('git log -1 --format=%an').toString().trim(),
      email: execSync('git log -1 --format=%ae').toString().trim(),
      remoteUrl: execSync('git config --get remote.origin.url').toString().trim(),
      repoName: execSync('git config --get remote.origin.url')
        .toString()
        .trim()
        .replace(/^.*github.com[:/]/, '')
        .replace(/\.git$/, ''),
    };
  } catch {
    return {
      commitHash: 'no-git-info',
      branch: 'unknown',
      commitTime: 'unknown',
      author: 'unknown',
      email: 'unknown',
      remoteUrl: 'unknown',
      repoName: 'unknown',
    };
  }
};

// Read package.json with detailed dependency info
const getPackageJson = () => {
  try {
    const pkgPath = join(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    return {
      name: pkg.name,
      description: pkg.description,
      license: pkg.license,
      dependencies: pkg.dependencies || {},
      devDependencies: pkg.devDependencies || {},
      peerDependencies: pkg.peerDependencies || {},
      optionalDependencies: pkg.optionalDependencies || {},
    };
  } catch {
    return {
      name: 'bolt.diy',
      description: 'A DIY LLM interface',
      license: 'MIT',
      dependencies: {},
      devDependencies: {},
      peerDependencies: {},
      optionalDependencies: {},
    };
  }
};

const pkg = getPackageJson();
const gitInfo = getGitInfo();

export default defineConfig((config) => {
  // Load environment variables including non-VITE_ prefixed ones
  const env = loadEnv(config.mode || 'development', process.cwd(), '');

  // Extract host configuration from environment (no defaults)
  const HOST = env.HOST;
  const PORT = Number(env.PORT || 5173);
  const LISTEN_HOST = HOST ? `local.${HOST}` : undefined;

  // Get base path from environment variable with /ai-editor as default
  const BASE_PATH = env.BASE_PATH || env.VITE_BASE_PATH || '/ai-editor';
  const BASE_URL = BASE_PATH ? (BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`) : '/';

  // Fern-FS proxy configuration from environment variable
  const getFernFsUrls = (baseUrl: string) => {
    const httpUrl = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
    const wsUrl = httpUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    return { httpUrl, wsUrl };
  };

  const fernFsUrl = env.FERN_FS_URL || (config.mode === 'production' ? 'ad-fern-fs:80' : 'localhost:8080');
  const proxyUrls = getFernFsUrls(fernFsUrl);

  // Check if we have SSL certificates for HTTPS
  const httpsConfig =
    LISTEN_HOST && existsSync(`certs/${LISTEN_HOST}.pem`) && existsSync(`certs/${LISTEN_HOST}-key.pem`)
      ? {
          key: readFileSync(`certs/${LISTEN_HOST}-key.pem`),
          cert: readFileSync(`certs/${LISTEN_HOST}.pem`),
        }
      : undefined;

  // Special handling for Electron development
  if (env.NODE_ENV === 'development' && env.ELECTRON === 'true') {
    // For Electron dev, we don't need base path since it runs locally
    return {
      base: '/',
      server: {
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',

          // Additional headers for WebContainer compatibility
          'Service-Worker-Allowed': '/',
          'X-Content-Type-Options': 'nosniff',
        },
        host: LISTEN_HOST || (process.env.RUNNING_IN_DOCKER ? '0.0.0.0' : 'localhost'),
        allowedHosts: true,
        port: PORT,
        https: httpsConfig,
        strictPort: true,

        // Make HMR work when using custom host
        hmr: LISTEN_HOST ? { host: LISTEN_HOST, port: PORT } : undefined,
        proxy: (() => {
          const proxyConfig: Record<string, any> = {};

          if (BASE_PATH) {
            // Fern-FS file sync endpoints with base path
            proxyConfig[`${BASE_PATH}/api/fern-fs`] = {
              target: proxyUrls.httpUrl,
              changeOrigin: true,
              rewrite: (path: string) =>
                path.replace(new RegExp(`^${BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/fern-fs`), '/api'),
              configure: (proxy: any) => {
                proxy.on('error', (err: any) => {
                  console.log('Proxy error:', err);
                });
                proxy.on('proxyReq', (proxyReq: any, req: any) => {
                  console.log('Proxying request:', req.method, req.url, '->', proxyReq.path);
                });
              },
            };
            proxyConfig[`${BASE_PATH}/ws/fern-fs`] = {
              target: proxyUrls.wsUrl,
              changeOrigin: true,
              rewrite: (path: string) =>
                path.replace(new RegExp(`^${BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/ws/fern-fs`), '/ws'),
              ws: true,
            };
          } else {
            // Default proxy when no base path
            proxyConfig['/api/fern-fs'] = {
              target: proxyUrls.httpUrl,
              changeOrigin: true,
              rewrite: (path: string) => path.replace(/^\/api\/fern-fs/, '/api'),
            };
            proxyConfig['/ws/fern-fs'] = {
              target: proxyUrls.wsUrl,
              changeOrigin: true,
              rewrite: (path: string) => path.replace(/^\/ws\/fern-fs/, '/ws'),
              ws: true,
            };
          }

          return proxyConfig;
        })(),
      },
      define: {
        __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
        __GIT_BRANCH: JSON.stringify(gitInfo.branch),
        __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
        __GIT_AUTHOR: JSON.stringify(gitInfo.author),
        __GIT_EMAIL: JSON.stringify(gitInfo.email),
        __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
        __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
        __APP_VERSION: JSON.stringify(process.env.npm_package_version),
        __PKG_NAME: JSON.stringify(pkg.name),
        __PKG_DESCRIPTION: JSON.stringify(pkg.description),
        __PKG_LICENSE: JSON.stringify(pkg.license),
        __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
        __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
        __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
        __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        __COMMIT_HASH__: JSON.stringify(gitInfo.commitHash || 'unknown'),
        __COMMIT_DATE__: JSON.stringify(gitInfo.commitTime || 'unknown'),
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version || 'unknown'),
        'import.meta.env.VITE_BASE_PATH': JSON.stringify(BASE_PATH),
        'import.meta.env.VITE_HOST': JSON.stringify(HOST),
        'import.meta.env.VITE_PORT': JSON.stringify(PORT.toString()),

        // Ensure BASE_URL is available in client-side code for proper asset path handling
        'import.meta.env.BASE_URL': JSON.stringify(BASE_URL),
      },
      build: {
        target: 'esnext',
      },
      plugins: [
        nodePolyfills({
          include: ['buffer', 'process', 'util', 'stream', 'path'],
          globals: {
            Buffer: true,
            process: true,
            global: true,
          },
          protocolImports: true,
          exclude: ['child_process', 'fs'],
        }),
        {
          name: 'buffer-polyfill',
          transform(code, id) {
            if (id.includes('env.mjs')) {
              return {
                code: `import { Buffer } from 'buffer';\n${code}`,
                map: null,
              };
            }

            return null;
          },
        },
        config.mode !== 'test' && remixCloudflareDevProxy(),
        remixVitePlugin({
          basename: BASE_URL,
          future: {
            v3_fetcherPersist: true,
            v3_relativeSplatPath: true,
            v3_throwAbortReason: true,
            v3_lazyRouteDiscovery: true,
          },
        }),
        UnoCSS(),
        tsconfigPaths(),
        chrome129IssuePlugin(),
        basePathDevPlugin(BASE_PATH),
        config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
      ],
      envPrefix: [
        'VITE_',
        'OPENAI_LIKE_API_BASE_URL',
        'OLLAMA_API_BASE_URL',
        'LMSTUDIO_API_BASE_URL',
        'TOGETHER_API_BASE_URL',
      ],
      css: {
        preprocessorOptions: {
          scss: {
            api: 'modern-compiler',
          },
        },
      },
    };
  }

  return {
    base: BASE_URL,
    server: {
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',

        // Additional headers for WebContainer compatibility
        'Service-Worker-Allowed': '/',
        'X-Content-Type-Options': 'nosniff',
      },
      host: LISTEN_HOST || (process.env.RUNNING_IN_DOCKER ? '0.0.0.0' : 'localhost'),
      allowedHosts: true,
      port: PORT,
      https: httpsConfig,
      strictPort: true,

      // Make HMR work when using custom host
      hmr: LISTEN_HOST ? { host: LISTEN_HOST, port: PORT } : undefined,
      proxy: (() => {
        const proxyConfig: Record<string, any> = {};

        if (BASE_PATH) {
          // Fern-FS file sync endpoints with base path
          proxyConfig[`${BASE_PATH}/api/fern-fs`] = {
            target: proxyUrls.httpUrl,
            changeOrigin: true,
            rewrite: (path: string) =>
              path.replace(new RegExp(`^${BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/fern-fs`), '/api'),
            configure: (proxy: any) => {
              proxy.on('error', (err: any) => {
                console.log('Proxy error:', err);
              });
              proxy.on('proxyReq', (proxyReq: any, req: any) => {
                console.log('Proxying request:', req.method, req.url, '->', proxyReq.path);
              });
            },
          };
          proxyConfig[`${BASE_PATH}/ws/fern-fs`] = {
            target: proxyUrls.wsUrl,
            changeOrigin: true,
            rewrite: (path: string) =>
              path.replace(new RegExp(`^${BASE_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/ws/fern-fs`), '/ws'),
            ws: true,
          };
        } else {
          // Default proxy when no base path
          proxyConfig['/api/fern-fs'] = {
            target: proxyUrls.httpUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/api\/fern-fs/, '/api'),
          };
          proxyConfig['/ws/fern-fs'] = {
            target: proxyUrls.wsUrl,
            changeOrigin: true,
            rewrite: (path: string) => path.replace(/^\/ws\/fern-fs/, '/ws'),
            ws: true,
          };
        }

        return proxyConfig;
      })(),
    },
    define: {
      __COMMIT_HASH: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH: JSON.stringify(gitInfo.branch),
      __GIT_COMMIT_TIME: JSON.stringify(gitInfo.commitTime),
      __GIT_AUTHOR: JSON.stringify(gitInfo.author),
      __GIT_EMAIL: JSON.stringify(gitInfo.email),
      __GIT_REMOTE_URL: JSON.stringify(gitInfo.remoteUrl),
      __GIT_REPO_NAME: JSON.stringify(gitInfo.repoName),
      __APP_VERSION: JSON.stringify(process.env.npm_package_version),
      __PKG_NAME: JSON.stringify(pkg.name),
      __PKG_DESCRIPTION: JSON.stringify(pkg.description),
      __PKG_LICENSE: JSON.stringify(pkg.license),
      __PKG_DEPENDENCIES: JSON.stringify(pkg.dependencies),
      __PKG_DEV_DEPENDENCIES: JSON.stringify(pkg.devDependencies),
      __PKG_PEER_DEPENDENCIES: JSON.stringify(pkg.peerDependencies),
      __PKG_OPTIONAL_DEPENDENCIES: JSON.stringify(pkg.optionalDependencies),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),

      // Ensure BASE_URL is available in client-side code for proper asset path handling
      'import.meta.env.BASE_URL': JSON.stringify(BASE_URL),
    },
    build: {
      target: 'esnext',
    },
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'path'],
        globals: {
          Buffer: true,
          process: true,
          global: true,
        },
        protocolImports: true,
        exclude: ['child_process', 'fs'],
      }),
      {
        name: 'buffer-polyfill',
        transform(code, id) {
          if (id.includes('env.mjs')) {
            return {
              code: `import { Buffer } from 'buffer';\n${code}`,
              map: null,
            };
          }

          return null;
        },
      },
      config.mode !== 'test' && remixCloudflareDevProxy(),
      remixVitePlugin({
        basename: BASE_URL,
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      UnoCSS(),
      tsconfigPaths(),
      chrome129IssuePlugin(),
      config.mode === 'production' && optimizeCssModules({ apply: 'build' }),
    ],
    envPrefix: [
      'VITE_',
      'OPENAI_LIKE_API_BASE_URL',
      'OLLAMA_API_BASE_URL',
      'LMSTUDIO_API_BASE_URL',
      'TOGETHER_API_BASE_URL',
    ],
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
  };
});

function basePathDevPlugin(basePath: string) {
  return {
    name: 'base-path-dev-plugin',
    configureServer(server: ViteDevServer) {
      if (!basePath) {
        return; // No base path, no need for middleware
      }

      // Simple middleware to handle redirects only
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';

        // Only handle requests that DON'T have the base path
        if (url.startsWith(basePath)) {
          // Already has base path, let it through
          next();
          return;
        }

        // Root redirect
        if (url === '/') {
          console.log(`[BasePathDev] Redirecting root to: ${basePath}/`);
          res.writeHead(301, { Location: `${basePath}/` });
          res.end();

          return;
        }

        // Static asset redirect (only if not already having base path)
        if (
          url.startsWith('/assets/') ||
          url.startsWith('/build/') ||
          url.startsWith('/@vite/') ||
          url.match(/\.(css|js|svg|png|jpg|jpeg|ico|woff|woff2|ttf|eot)$/)
        ) {
          const redirectUrl = `${basePath}${url}`;
          console.log(`[BasePathDev] Redirecting asset: ${url} -> ${redirectUrl}`);
          res.writeHead(301, { Location: redirectUrl });
          res.end();

          return;
        }

        // For all other requests, let them through (Remix will handle)
        next();
      });
    },
  };
}

function chrome129IssuePlugin() {
  return {
    name: 'chrome129IssuePlugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const raw = req.headers['user-agent']?.match(/Chrom(e|ium)\/([0-9]+)\./);

        if (raw) {
          const version = parseInt(raw[2], 10);

          if (version === 129) {
            res.setHeader('content-type', 'text/html');
            res.end(
              '<body><h1>Please use Chrome Canary for testing.</h1><p>Chrome 129 has an issue with JavaScript modules & Vite local development, see <a href="https://github.com/stackblitz/bolt.new/issues/86#issuecomment-2395519258">for more information.</a></p><p><b>Note:</b> This only impacts <u>local development</u>. `pnpm run build` and `pnpm run start` will work fine in this browser.</p></body>',
            );

            return;
          }
        }

        next();
      });
    },
  };
}
