import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { installFetchInterceptor } from '~/lib/fetch-interceptor';

// Initialize logger controls for browser console access
import '~/utils/logger';

// Install fetch interceptor before any API calls
installFetchInterceptor();

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
