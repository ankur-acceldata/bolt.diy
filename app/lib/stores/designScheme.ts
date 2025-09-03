import { atom } from 'nanostores';
import type { DesignScheme } from '~/types/design-scheme';
import { defaultDesignScheme } from '~/types/design-scheme';

const DESIGN_SCHEME_KEY = 'bolt_design_scheme';

// Check if we're in the browser
const isBrowser = typeof window !== 'undefined';

// Get initial design scheme from localStorage or use default
function getInitialDesignScheme(): DesignScheme {
  if (!isBrowser) {
    return defaultDesignScheme;
  }

  try {
    const stored = localStorage.getItem(DESIGN_SCHEME_KEY);

    if (stored) {
      const parsed = JSON.parse(stored);

      // Ensure all required properties exist, merge with defaults
      return {
        palette: { ...defaultDesignScheme.palette, ...parsed.palette },
        features: parsed.features || defaultDesignScheme.features,
        font: parsed.font || defaultDesignScheme.font,
      };
    }
  } catch (error) {
    console.warn('Failed to parse stored design scheme:', error);
  }

  return defaultDesignScheme;
}

// Create the design scheme store
export const designSchemeStore = atom<DesignScheme>(getInitialDesignScheme());

// Function to update design scheme
export function setDesignScheme(scheme: DesignScheme) {
  designSchemeStore.set(scheme);

  if (isBrowser) {
    try {
      localStorage.setItem(DESIGN_SCHEME_KEY, JSON.stringify(scheme));
      applyDesignSchemeToDOM(scheme);
    } catch (error) {
      console.error('Failed to save design scheme to localStorage:', error);
    }
  }
}

// Function to apply design scheme to DOM
function applyDesignSchemeToDOM(scheme: DesignScheme) {
  if (!isBrowser) {
    return;
  }

  const root = document.documentElement;

  // Apply palette colors as CSS custom properties
  Object.entries(scheme.palette).forEach(([key, value]) => {
    root.style.setProperty(`--design-${key}`, value);
  });

  // Apply features as CSS classes
  const featureClasses = ['rounded', 'border', 'gradient', 'shadow', 'frosted-glass'];

  // Remove all feature classes first
  featureClasses.forEach((feature) => {
    root.classList.remove(`design-${feature}`);
  });

  // Add selected feature classes
  scheme.features.forEach((feature) => {
    if (featureClasses.includes(feature)) {
      root.classList.add(`design-${feature}`);
    }
  });

  // Apply font preferences
  const fontString = scheme.font.join(', ');
  root.style.setProperty('--design-font-family', fontString);
}

// Initialize design scheme on store creation
if (isBrowser) {
  // Apply initial design scheme to DOM
  applyDesignSchemeToDOM(designSchemeStore.get());

  // Listen for store changes and apply them
  designSchemeStore.subscribe((scheme) => {
    applyDesignSchemeToDOM(scheme);
  });
}

// Function to reset design scheme to default
export function resetDesignScheme() {
  setDesignScheme(defaultDesignScheme);
}

// Function to get current design scheme
export function getDesignScheme(): DesignScheme {
  return designSchemeStore.get();
}
