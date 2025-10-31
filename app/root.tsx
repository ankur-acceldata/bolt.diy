import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { useCommunicationBusChild, useJobPromotionResponder } from './lib/hooks/communicationBus';
import { initializeURLTracking, restoreURLState, saveURLState } from './utils/urlStateManager';
import { initializeURLStateDebug } from './utils/urlStateDebug';
import { createScopedLogger } from './utils/logger';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

const logger = createScopedLogger('Layout');

export function Layout({ children }: { children: React.ReactNode }) {
  const themeConfig = useStore(themeStore);
  const location = useLocation();
  const urlTrackingInitialized = useRef(false);
  const isInitialMount = useRef(true);

  // Initialize communication bus for iframe child
  useCommunicationBusChild({
    logLevel: 'error',
    targetOrigin: '*',
  });

  // Initialize job promotion functionality
  useJobPromotionResponder();

  // Restore last URL state FIRST, then initialize tracking
  useEffect(() => {
    // Only run once on mount
    if (urlTrackingInitialized.current) {
      return undefined;
    }

    urlTrackingInitialized.current = true;

    /*
     * Check if we're loading directly on a chat URL
     * If so, skip restoration and just track from here
     */
    const currentPath = window.location.pathname;
    const isOnChatPage = currentPath.includes('/chat/');

    if (isOnChatPage) {
      logger.info('Loading directly on chat page, skipping restoration');

      // Save current URL state since we're on a specific chat
      saveURLState(currentPath, window.location.search, window.location.hash);

      // Initialize tracking immediately
      const cleanup = initializeURLTracking();

      // Initialize debug tools (only in development)
      if (import.meta.env.DEV) {
        initializeURLStateDebug();
      }

      return cleanup;
    }

    /*
     * We're on home page - attempt restoration
     * This will only restore if there's a valid saved state
     */
    const restored = restoreURLState();

    /*
     * Only initialize tracking if we didn't restore
     * If we restored, tracking will initialize after the redirect
     */
    if (!restored) {
      // Initialize URL tracking to monitor navigation changes
      const cleanup = initializeURLTracking();

      // Initialize debug tools (only in development)
      if (import.meta.env.DEV) {
        initializeURLStateDebug();
      }

      return cleanup;
    }

    // If we restored, initialize tracking after a short delay
    const timeoutId = setTimeout(() => {
      const cleanup = initializeURLTracking();

      // Initialize debug tools (only in development)
      if (import.meta.env.DEV) {
        initializeURLStateDebug();
      }

      // Store cleanup in a way that can be accessed for unmount
      (window as any).__urlTrackingCleanup = cleanup;
    }, 200);

    return () => {
      clearTimeout(timeoutId);

      if ((window as any).__urlTrackingCleanup) {
        (window as any).__urlTrackingCleanup();
        delete (window as any).__urlTrackingCleanup;
      }
    };
  }, []);

  // Track Remix location changes
  useEffect(() => {
    // Skip the very first mount to allow restoration to happen first
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Save URL state whenever the location changes (after initial mount)
    saveURLState(location.pathname, location.search, location.hash);
  }, [location]);

  useEffect(() => {
    const html = document.querySelector('html');

    if (!html) {
      return;
    }

    // Set theme mode attribute
    html.setAttribute('data-theme', themeConfig.mode);

    // Remove all existing color theme classes
    html.classList.remove('color-blue', 'color-green', 'color-purple', 'color-orange');

    // Add color theme class if not default
    if (themeConfig.color !== 'default') {
      html.classList.add(`color-${themeConfig.color}`);
    }
  }, [themeConfig]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const themeConfig = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme: themeConfig,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
