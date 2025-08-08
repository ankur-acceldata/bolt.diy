import { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from '~/utils/logger';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

const logger = createScopedLogger('WebContainer');

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  logger.debug('WebContainer initialization starting - not SSR');
  logger.debug('Current URL:', window.location.href);
  logger.debug('In iframe?', window !== window.parent);
  logger.debug('Cross-origin isolated:', crossOriginIsolated);
  logger.debug('SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');

  // Detect iframe context and adjust configuration
  const isInIframe = window !== window.parent;
  logger.debug('Iframe context detected:', isInIframe);

  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        logger.debug('Starting WebContainer boot with coep: require-corp');
        return WebContainer.boot({
          coep: 'require-corp',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        logger.info('WebContainer booted successfully');
        webcontainerContext.loaded = true;

        const { workbenchStore } = await import('~/lib/stores/workbench');

        try {
          // Use dynamic base path for inspector script
          const { getBaseUrl } = await import('~/lib/config');
          const baseUrl = getBaseUrl();
          const response = await fetch(`${baseUrl}inspector-script.js`);
          const inspectorScript = await response.text();
          await webcontainer.setPreviewScript(inspectorScript);
          logger.debug('Inspector script loaded successfully');
        } catch (error) {
          logger.warn('Failed to load inspector script:', error);
        }

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          logger.debug('WebContainer preview message:', message);

          // Handle both uncaught exceptions and unhandled promise rejections
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
            workbenchStore.actionAlert.set({
              type: 'preview',
              title,
              description: 'message' in message ? message.message : 'Unknown error',
              content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
              source: 'preview',
            });
          }
        });

        logger.info('WebContainer fully initialized');

        return webcontainer;
      })
      .catch((error) => {
        logger.error('WebContainer boot failed:', error);
        webcontainerContext.loaded = false;
        throw error;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
} else {
  logger.debug('SSR mode - skipping WebContainer initialization');
}
