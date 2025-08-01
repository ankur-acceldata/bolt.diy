import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { installFetchInterceptor } from '~/lib/fetch-interceptor';

// Install fetch interceptor before any API calls
installFetchInterceptor();

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
