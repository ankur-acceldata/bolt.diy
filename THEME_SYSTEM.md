# Multi-Theme System

This project now supports both light/dark modes and multiple color themes (blue, green, purple, orange) in addition to the original default theme.

## Features

- **Mode Toggle**: Switch between light and dark modes
- **Color Themes**: Choose from 5 different color variants:
  - Default (original bolt.diy theme)
  - Acceldata Blue (professional blue theme)
  - Forest Green (natural green theme)
  - Royal Purple (creative purple theme)
  - Sunset Orange (warm orange theme)

## Implementation

### Theme Store
- Extended `themeStore` to support `ThemeConfig` with `mode` and `color` properties
- Themes are persisted in localStorage
- Automatic theme application via CSS classes and data attributes

### CSS Variables
- Added comprehensive CSS variable definitions for all theme combinations
- Light mode variants: `:root.color-{theme}`
- Dark mode variants: `:root[data-theme='dark'].color-{theme}`

### UI Components
- Enhanced `ThemeSwitch` component with dropdown for color selection
- Shows current theme with colored indicator
- Supports both keyboard and mouse interaction

## Usage

The theme system automatically applies the selected theme across all components. Users can:

1. **Toggle Light/Dark Mode**: Click the sun/moon icon
2. **Change Color Theme**: Click the colored dot dropdown to select from available themes

## Technical Details

### CSS Class Structure
```css
/* Light mode with color theme */
:root.color-blue { /* ... */ }
:root.color-green { /* ... */ }

/* Dark mode with color theme */
:root[data-theme='dark'].color-blue { /* ... */ }
:root[data-theme='dark'].color-green { /* ... */ }
```

### Theme Configuration
```typescript
interface ThemeConfig {
  mode: 'light' | 'dark';
  color: 'default' | 'blue' | 'green' | 'purple' | 'orange';
}
```

### Persistence
- Mode: Stored in `bolt_theme` localStorage key
- Color: Stored in `bolt_color_theme` localStorage key
- Also synchronized with user profile if available

## Color Palette

Each theme includes carefully chosen color palettes for:
- Primary/secondary colors
- Background depths (1-4 levels)
- Text colors (primary, secondary, tertiary)
- Button states
- Icons and borders
- Code syntax highlighting backgrounds
- Terminal colors remain consistent across themes