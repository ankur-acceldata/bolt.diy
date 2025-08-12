import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

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
  console.log('DEBUG: WebContainer initialization starting - not SSR');
  console.log('DEBUG: Current URL:', window.location.href);
  console.log('DEBUG: In iframe?', window !== window.parent);
  console.log('DEBUG: Cross-origin isolated:', crossOriginIsolated);
  console.log('DEBUG: SharedArrayBuffer available:', typeof SharedArrayBuffer !== 'undefined');

  // Detect iframe context and adjust configuration
  const isInIframe = window !== window.parent;
  console.log('DEBUG: Iframe context detected:', isInIframe);

  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        console.log('DEBUG: Starting WebContainer boot with coep: require-corp');
        return WebContainer.boot({
          coep: 'require-corp',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        console.log('DEBUG: WebContainer booted successfully');
        webcontainerContext.loaded = true;

        const { workbenchStore } = await import('~/lib/stores/workbench');

        try {
          // Use dynamic base path for inspector script
          const { getBaseUrl } = await import('~/lib/config');
          const baseUrl = getBaseUrl();
          const response = await fetch(`${baseUrl}inspector-script.js`);
          const inspectorScript = await response.text();
          await webcontainer.setPreviewScript(inspectorScript);
          console.log('DEBUG: Inspector script loaded successfully');
        } catch (error) {
          console.warn('DEBUG: Failed to load inspector script:', error);
        }

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('WebContainer preview message:', message);

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

        console.log('DEBUG: WebContainer fully initialized');

        return webcontainer;
      })
      .catch((error) => {
        console.error('DEBUG: WebContainer boot failed:', error);
        webcontainerContext.loaded = false;
        throw error;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
} else {
  console.log('DEBUG: SSR mode - skipping WebContainer initialization');
}
