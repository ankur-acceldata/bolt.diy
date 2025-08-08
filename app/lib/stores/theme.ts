import { atom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import { logStore } from './logs';

const logger = createScopedLogger('ThemeStore');

export type Theme = 'dark' | 'light';
export type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'orange';

export interface ThemeConfig {
  mode: Theme;
  color: ColorTheme;
}

export const kTheme = 'bolt_theme';
export const kColorTheme = 'bolt_color_theme';

export function themeIsDark() {
  return themeStore.get().mode === 'dark';
}

export const DEFAULT_THEME: ThemeConfig = {
  mode: 'light',
  color: 'default',
};

// Parent theme integration keys
export const kParentTheme = 'acceldata-ui-theme';
export const kParentColorTheme = 'acceldata-ui-color-scheme';

export const themeStore = atom<ThemeConfig>(initStore());

function getParentTheme(): { mode?: Theme; color?: ColorTheme } {
  try {
    // Check if we're in an iframe and can access parent
    if (window !== window.parent && window.parent.localStorage) {
      const parentTheme = window.parent.localStorage.getItem(kParentTheme) as Theme | undefined;
      const parentColorTheme = window.parent.localStorage.getItem(kParentColorTheme) as ColorTheme | undefined;

      logger.debug('Parent theme detected:', { parentTheme, parentColorTheme });

      return {
        mode: parentTheme,
        color: parentColorTheme,
      };
    }
  } catch {
    // Cross-origin access restriction - fall back to postMessage
    logger.debug('Cannot access parent localStorage directly, using postMessage fallback');
  }

  return {};
}

function initStore(): ThemeConfig {
  if (!import.meta.env.SSR) {
    // Priority order: Parent theme > Local storage > HTML attribute > Default
    const parentThemeSettings = getParentTheme();
    const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
    const persistedColorTheme = localStorage.getItem(kColorTheme) as ColorTheme | undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    // Initialize with parent theme first, then fallback to local settings
    const theme: ThemeConfig = {
      mode: parentThemeSettings.mode || persistedTheme || (themeAttribute as Theme) || DEFAULT_THEME.mode,
      color: parentThemeSettings.color || persistedColorTheme || DEFAULT_THEME.color,
    };

    logger.debug('Theme initialized:', theme);

    // Sync with parent if available
    syncWithParent(theme);

    return theme;
  }

  return DEFAULT_THEME;
}

function syncWithParent(theme: ThemeConfig) {
  try {
    // Try to sync with parent localStorage if accessible
    if (window !== window.parent && window.parent.localStorage) {
      window.parent.localStorage.setItem(kParentTheme, theme.mode);
      window.parent.localStorage.setItem(kParentColorTheme, theme.color);
      logger.debug('Synced theme with parent:', theme);
    }
  } catch {
    // If cross-origin, use postMessage to notify parent
    try {
      window.parent.postMessage(
        {
          type: 'BOLT_THEME_CHANGE',
          theme: theme.mode,
          colorTheme: theme.color,
        },
        '*',
      );
      logger.debug('Sent theme change to parent via postMessage:', theme);
    } catch {
      logger.debug('Could not sync with parent');
    }
  }
}

function applyTheme(theme: ThemeConfig) {
  const html = document.querySelector('html');

  if (!html) {
    return;
  }

  // Set theme mode attribute
  html.setAttribute('data-theme', theme.mode);

  // Remove all existing color theme classes
  html.classList.remove('color-blue', 'color-green', 'color-purple', 'color-orange');

  // Add color theme class if not default
  if (theme.color !== 'default') {
    html.classList.add(`color-${theme.color}`);
  }
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme: ThemeConfig = {
    ...currentTheme,
    mode: currentTheme.mode === 'dark' ? 'light' : 'dark',
  };

  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kTheme, newTheme.mode);
  localStorage.setItem(kColorTheme, newTheme.color);

  // Sync with parent
  syncWithParent(newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = newTheme.mode;
      profile.colorTheme = newTheme.color;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    logger.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${newTheme.mode} mode with ${newTheme.color} color`);
}

export function setColorTheme(color: ColorTheme) {
  const currentTheme = themeStore.get();
  const newTheme: ThemeConfig = {
    ...currentTheme,
    color,
  };

  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kColorTheme, color);

  // Sync with parent
  syncWithParent(newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.colorTheme = color;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    logger.error('Error updating user profile color theme:', error);
  }

  logStore.logSystem(`Color theme changed to ${color}`);
}

export function setTheme(theme: ThemeConfig) {
  // Update the theme store
  themeStore.set(theme);

  // Update localStorage
  localStorage.setItem(kTheme, theme.mode);
  localStorage.setItem(kColorTheme, theme.color);

  // Apply the theme
  applyTheme(theme);

  // Sync with parent
  syncWithParent(theme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = theme.mode;
      profile.colorTheme = theme.color;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    logger.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${theme.mode} mode with ${theme.color} color`);
}

// Listen for theme changes from parent window
if (!import.meta.env.SSR) {
  window.addEventListener('message', (event) => {
    // Accept messages from any origin for theme changes
    if (event.data && event.data.type === 'ACCELDATA_THEME_CHANGE') {
      const { theme, colorTheme } = event.data;

      if (theme && (theme === 'light' || theme === 'dark')) {
        logger.debug('Received theme change from parent:', { theme, colorTheme });

        const currentTheme = themeStore.get();
        const newTheme: ThemeConfig = {
          mode: theme,
          color: colorTheme || currentTheme.color,
        };

        // Update without syncing back to parent to avoid infinite loop
        themeStore.set(newTheme);
        localStorage.setItem(kTheme, newTheme.mode);
        localStorage.setItem(kColorTheme, newTheme.color);
        applyTheme(newTheme);

        logStore.logSystem(`Theme updated from parent: ${newTheme.mode} mode with ${newTheme.color} color`);
      }
    }
  });

  // Also listen for storage changes in case parent updates localStorage directly
  window.addEventListener('storage', (event) => {
    if (event.key === kParentTheme || event.key === kParentColorTheme) {
      const parentThemeSettings = getParentTheme();

      if (parentThemeSettings.mode || parentThemeSettings.color) {
        const currentTheme = themeStore.get();
        const newTheme: ThemeConfig = {
          mode: parentThemeSettings.mode || currentTheme.mode,
          color: parentThemeSettings.color || currentTheme.color,
        };

        themeStore.set(newTheme);
        localStorage.setItem(kTheme, newTheme.mode);
        localStorage.setItem(kColorTheme, newTheme.color);
        applyTheme(newTheme);

        logger.debug('Theme updated from parent storage change:', newTheme);
      }
    }
  });
}
