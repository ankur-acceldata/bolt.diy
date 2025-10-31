/**
 * URL State Manager
 * Manages URL state persistence in localStorage for iframe-based applications
 * Tracks navigation changes and restores last visited URL on app load
 */

import { createScopedLogger } from './logger';
import { getBasePath } from '~/lib/config';

const logger = createScopedLogger('URLStateManager');

const STORAGE_KEY = 'bolt_last_url';
const STORAGE_TIMESTAMP_KEY = 'bolt_last_url_timestamp';
const NAVIGATION_INTENT_KEY = 'bolt_navigation_intent';

export interface URLState {
  pathname: string;
  search: string;
  hash: string;
  timestamp: number;
}

/**
 * Save the current URL state to localStorage
 */
export function saveURLState(pathname?: string, search?: string, hash?: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    const state: URLState = {
      pathname: pathname ?? window.location.pathname,
      search: search ?? window.location.search,
      hash: hash ?? window.location.hash,
      timestamp: Date.now(),
    };

    // Don't save if we're on the home page (no need to restore to home)
    const basePath = getBasePathFromConfig();
    const normalizedPathname = state.pathname.replace(/\/$/, '') || '/';
    const normalizedBasePath = basePath.replace(/\/$/, '') || '';

    const isHome =
      normalizedPathname === '/' ||
      normalizedPathname === normalizedBasePath ||
      normalizedPathname === '' ||
      (!!normalizedBasePath && normalizedPathname === normalizedBasePath);

    if (isHome) {
      logger.debug('Skipping save for home page:', {
        pathname: state.pathname,
        normalizedPathname,
        basePath,
        normalizedBasePath,
      });

      // Clear any existing saved state when going to home
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP_KEY);

      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(STORAGE_TIMESTAMP_KEY, String(state.timestamp));

    logger.debug('URL state saved:', state);
  } catch (error) {
    logger.error('Failed to save URL state:', error);
  }
}

/**
 * Get the last saved URL state from localStorage
 */
export function getLastURLState(): URLState | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }

    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    const state = JSON.parse(stored) as URLState;
    logger.debug('Retrieved URL state:', state);

    return state;
  } catch (error) {
    logger.error('Failed to retrieve URL state:', error);
    return null;
  }
}

/**
 * Clear the saved URL state from localStorage
 */
export function clearURLState(): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIMESTAMP_KEY);
    logger.debug('URL state cleared');
  } catch (error) {
    logger.error('Failed to clear URL state:', error);
  }
}

/**
 * Check if the current URL is the home page
 */
export function isHomePage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const pathname = window.location.pathname;
  const basePath = getBasePathFromConfig();

  /*
   * Normalize paths for comparison (remove trailing slashes)
   * Home page is when pathname equals basePath or is just "/"
   */
  const normalizedPathname = pathname.replace(/\/$/, '') || '/';
  const normalizedBasePath = basePath.replace(/\/$/, '') || '';

  const isHome =
    normalizedPathname === '/' ||
    normalizedPathname === normalizedBasePath ||
    normalizedPathname === '' ||
    (!!normalizedBasePath && normalizedPathname === normalizedBasePath);

  logger.debug('isHomePage check:', {
    pathname,
    basePath,
    normalizedPathname,
    normalizedBasePath,
    isHome,
  });

  return isHome;
}

/**
 * Get base path from configuration
 * Uses the centralized config system
 */
function getBasePathFromConfig(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    // Use the centralized config system
    return getBasePath();
  } catch (error) {
    logger.error('Failed to get base path from config:', error);
    return '';
  }
}

/**
 * Check if we should restore the URL (not on home page and has saved state)
 */
export function shouldRestoreURL(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const currentPathname = window.location.pathname;
  const basePath = getBasePathFromConfig();

  /*
   * Check if we're on home page
   * Need to distinguish between:
   * 1. User clicked "Start new chat" → Don't restore
   * 2. User is on home and should restore to last chat
   */
  const onHomePage = isHomePage();

  if (onHomePage) {
    // Check if user intentionally navigated to home (e.g., clicked "Start new chat")
    const navigationIntent = sessionStorage.getItem(NAVIGATION_INTENT_KEY);

    if (navigationIntent === 'new_chat') {
      logger.debug('User clicked "Start new chat", clearing saved state');
      clearURLState();
      sessionStorage.removeItem(NAVIGATION_INTENT_KEY);

      return false;
    }

    /*
     * User is on home page but didn't click "Start new chat"
     * This could be:
     * - Initial load on home → Restore to last chat
     * - Reload while on home → Stay on home
     * - Direct navigation to home → Restore to last chat
     */
    logger.debug('On home page, checking for saved state to restore');
  } else {
    // We're on a specific page (not home), don't restore
    logger.debug('Already on specific page, not restoring:', currentPathname);

    return false;
  }

  // Check if we have a saved state
  const lastState = getLastURLState();

  if (!lastState) {
    logger.debug('No saved URL state found');
    return false;
  }

  // Don't restore if the saved state is the home page
  const savedPathname = lastState.pathname;
  const normalizedSavedPathname = savedPathname.replace(/\/$/, '') || '/';
  const normalizedBasePath = basePath.replace(/\/$/, '') || '';

  const savedIsHome =
    normalizedSavedPathname === '/' ||
    normalizedSavedPathname === normalizedBasePath ||
    normalizedSavedPathname === '' ||
    (!!normalizedBasePath && normalizedSavedPathname === normalizedBasePath);

  if (savedIsHome) {
    logger.debug('Saved state is home page, not restoring');
    return false;
  }

  // Don't restore if saved state is the same as current (avoid unnecessary reload)
  const currentFull = `${currentPathname}${window.location.search}${window.location.hash}`;
  const savedFull = `${lastState.pathname}${lastState.search}${lastState.hash}`;

  if (currentFull === savedFull) {
    logger.debug('Current URL matches saved state, no restoration needed');
    return false;
  }

  logger.debug('Should restore URL:', {
    currentPathname,
    savedPathname,
    savedIsHome,
  });

  return true;
}

/**
 * Restore the last saved URL state
 */
export function restoreURLState(): boolean {
  try {
    const currentPathname = window.location.pathname;
    const currentSearch = window.location.search;
    const currentHash = window.location.hash;

    logger.debug('Checking restoration:', {
      currentPathname,
      currentSearch,
      currentHash,
    });

    if (!shouldRestoreURL()) {
      logger.debug('Should not restore URL');
      return false;
    }

    const lastState = getLastURLState();

    if (!lastState) {
      logger.debug('No saved state to restore');
      return false;
    }

    const fullURL = `${lastState.pathname}${lastState.search}${lastState.hash}`;
    logger.info('Restoring last URL:', {
      from: `${currentPathname}${currentSearch}${currentHash}`,
      to: fullURL,
    });

    // Use replace to avoid adding to history
    window.location.replace(fullURL);

    return true;
  } catch (error) {
    logger.error('Failed to restore URL state:', error);
    return false;
  }
}

/**
 * Initialize URL state tracking
 * Sets up listeners to track URL changes
 */
export function initializeURLTracking(): () => void {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  logger.info('Initializing URL state tracking');

  /*
   * Don't save initial URL state here - let the location effect handle it
   * This prevents overwriting the saved state before restoration
   */

  // Track popstate events (back/forward navigation)
  const handlePopState = () => {
    logger.debug('PopState event detected');
    saveURLState();
  };

  // Track pushState and replaceState
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    logger.debug('PushState detected');
    saveURLState();

    return result;
  };

  window.history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    logger.debug('ReplaceState detected');
    saveURLState();

    return result;
  };

  // Track hash changes
  const handleHashChange = () => {
    logger.debug('HashChange event detected');
    saveURLState();
  };

  // Add event listeners
  window.addEventListener('popstate', handlePopState);
  window.addEventListener('hashchange', handleHashChange);

  // Cleanup function
  return () => {
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);

    // Restore original methods
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;

    logger.info('URL state tracking cleaned up');
  };
}
