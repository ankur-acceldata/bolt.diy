/**
 * URL State Debugging Utilities
 * Helper functions for debugging URL state persistence
 * These functions are exposed to window object for easy console access
 */

import { getLastURLState, clearURLState, saveURLState } from './urlStateManager';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('URLStateDebug');

export interface URLStateDebugTools {
  getState: () => void;
  clearState: () => void;
  saveCurrentState: () => void;
  testRestore: () => void;
  help: () => void;
}

/**
 * Get and display the current saved URL state
 */
function getState(): void {
  const state = getLastURLState();

  if (state) {
    logger.info('Current saved URL state:', {
      pathname: state.pathname,
      search: state.search,
      hash: state.hash,
      timestamp: new Date(state.timestamp).toLocaleString(),
      age: `${Math.round((Date.now() - state.timestamp) / 1000)}s ago`,
    });
  } else {
    logger.info('No saved URL state found');
  }
}

/**
 * Clear the saved URL state
 */
function clearState(): void {
  clearURLState();
  logger.info('URL state cleared');
}

/**
 * Manually save the current URL state
 */
function saveCurrentState(): void {
  saveURLState();
  logger.info('Current URL state saved');
  getState();
}

/**
 * Test URL restoration without reloading
 */
function testRestore(): void {
  const state = getLastURLState();

  if (!state) {
    logger.warn('No saved state to restore');
    return;
  }

  const fullURL = `${state.pathname}${state.search}${state.hash}`;
  logger.info('Would restore to:', fullURL);
  logger.info('Current URL:', window.location.pathname + window.location.search + window.location.hash);

  const isHome =
    window.location.pathname === '/' ||
    window.location.pathname === '' ||
    window.location.pathname.endsWith('/ai-editor/');

  if (isHome) {
    logger.info('✓ Restoration would occur (currently on home page)');
  } else {
    logger.info('✗ Restoration would NOT occur (already on specific page)');
  }
}

/**
 * Display help information
 */
function help(): void {
  logger.info(`
URL State Debug Tools
=====================

Available commands:
  urlState.getState()         - Display current saved URL state
  urlState.clearState()       - Clear saved URL state
  urlState.saveCurrentState() - Manually save current URL
  urlState.testRestore()      - Test if restoration would occur
  urlState.help()             - Show this help message

Direct localStorage access:
  localStorage.getItem('bolt_last_url')
  localStorage.removeItem('bolt_last_url')

Example workflow:
  1. Navigate to a chat
  2. urlState.getState()       // Check what's saved
  3. Reload page               // Should restore to chat
  4. urlState.clearState()     // Clear for testing
  5. Reload page               // Should stay on home
  `);
}

/**
 * Initialize debug tools on window object
 */
export function initializeURLStateDebug(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Expose debug tools to window object
  (window as any).urlState = {
    getState,
    clearState,
    saveCurrentState,
    testRestore,
    help,
  } as URLStateDebugTools;

  logger.info('URL State debug tools initialized. Type "urlState.help()" for usage.');
}
